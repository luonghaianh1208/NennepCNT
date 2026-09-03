import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  convertInchesToTwip, TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';
import { Violation, ClassEntity, Student, Criteria, TimeConfig, User } from '../types';
import { calculateScore, isDateInRange } from '../utils';

interface ReportInput {
  weekConfig: TimeConfig;
  allWeekConfigs: TimeConfig[];
  violations: Violation[];
  classes: ClassEntity[];
  students: Student[];
  criteria: Criteria[];
  currentUser: User;
  isLeader: boolean;       // true nếu xuất dưới tư cách Lãnh đạo
  // Quy định của trường — báo cáo phải tính đúng bằng công thức đang hiện trên
  // màn hình, nếu không thì sổ in ra một đằng, phần mềm hiện một nẻo.
  baseScore: number;
  grades: string[];
}

// Màu đỏ đậm dùng cho phần NHƯỢC ĐIỂM và heading phụ
const RED = 'C00000';
const BLACK = '000000';

/** Tiêu đề chính, căn giữa, bold, size 14 */
const mainTitle = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 28, color: BLACK })],
    spacing: { after: 0 },
  });

/** Phụ đề màu đỏ, căn giữa */
const subtitle = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, color: RED, size: 24 })],
    spacing: { after: 240 },
  });

/** Đoạn văn bình thường */
const para = (runs: TextRun[], spacingAfter = 120) =>
  new Paragraph({
    children: runs,
    spacing: { after: spacingAfter },
  });

/** TextRun bình thường */
const run = (text: string, bold = false, color = BLACK, size = 24) =>
  new TextRun({ text, bold, color, size });

/** Section header: "1. ƯU ĐIỂM" */
const sectionHeader = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BLACK })],
    spacing: { before: 160, after: 80 },
  });

/** Tạo bảng xếp hạng: mỗi khối của trường chiếm 3 cột Lớp — Điểm — Hạng */
const buildRankingTable = (
  classes: ClassEntity[],
  relevantViolations: Violation[],
  weeksCount: number,
  baseScore: number,
  schoolGrades: string[],
): Table => {
  // Khối cao xếp trước, đúng như sổ vẫn in tay: K12 rồi K11 rồi K10
  const grades = [...schoolGrades].sort((a, b) => Number(b) - Number(a));
  const columnHeaders = grades.flatMap(grade => [`Lớp K${grade}`, 'Điểm', 'Hạng']);

  // Xếp hạng từng khối
  const ranked: Record<string, { name: string; score: number; rank: number }[]> = {};
  grades.forEach(grade => {
    const gradeClasses = classes.filter(c => String(c.grade) === grade);
    const stats = gradeClasses.map(cls => {
      const clsV = relevantViolations.filter(v => v.classId === cls.id);
      const score = calculateScore(clsV, baseScore, weeksCount, false);
      return { name: cls.name, score };
    }).sort((a, b) => b.score - a.score);

    ranked[grade] = stats.map((item, idx) => {
      let rank = idx + 1;
      if (idx > 0 && item.score === stats[idx - 1].score) {
        let fi = idx;
        while (fi > 0 && stats[fi - 1].score === item.score) fi--;
        rank = fi + 1;
      }
      return { ...item, rank };
    });
  });

  const maxRows = Math.max(0, ...grades.map(grade => ranked[grade].length));

  const cellStyle = (text: string, bold = false, bgColor?: string) =>
    new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold, size: 20 })],
      })],
      shading: bgColor ? { type: ShadingType.SOLID, color: bgColor } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

  // Header row
  const headerRow = new TableRow({
    children: columnHeaders.map(h => cellStyle(h, true, 'D9E1F2')),
    tableHeader: true,
  });

  // Data rows
  const dataRows = Array.from({ length: maxRows }, (_, i) => {
    const cells: TableCell[] = [];
    grades.forEach(grade => {
      const item = ranked[grade][i];
      cells.push(cellStyle(item?.name || '', false));
      cells.push(cellStyle(item ? String(item.score) : '', false));
      cells.push(cellStyle(item ? String(item.rank) : '', false));
    });
    return new TableRow({ children: cells });
  });

  // Chia đều bề ngang cho các khối, giữ đúng tỉ lệ Lớp : Điểm : Hạng của bản in cũ
  const groupWidth = Math.floor(9900 / (grades.length || 1));
  const columnWidths = grades.flatMap(() => {
    const nameWidth = Math.round(groupWidth * 0.545);
    const scoreWidth = Math.round(groupWidth * 0.242);
    return [nameWidth, scoreWidth, groupWidth - nameWidth - scoreWidth];
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    rows: [headerRow, ...dataRows],
  });
};

/** Tính streak tuần liên tiếp không vi phạm (kể cả tuần hiện tại) */
const computeStreak = (
  classId: string,
  currentWeek: TimeConfig,
  allWeekConfigs: TimeConfig[],
  allViolations: Violation[],
): number => {
  const sortedWeeks = [...allWeekConfigs]
    .filter(w => w.type === 'WEEK')
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const currentIdx = sortedWeeks.findIndex(w => w.id === currentWeek.id);
  if (currentIdx === -1) return 1;
  let streak = 0;
  for (let i = currentIdx; i < sortedWeeks.length; i++) {
    const week = sortedWeeks[i];
    const hasViolation = allViolations.some(v =>
      v.classId === classId && v.points > 0 &&
      isDateInRange(v.date, week.startDate, week.endDate)
    );
    if (hasViolation) break;
    streak++;
  }
  return Math.max(streak, 1);
};

/** Main export function */
export const generateWeeklyReport = async (input: ReportInput): Promise<void> => {
  const { weekConfig, allWeekConfigs, violations, classes, students, criteria, currentUser, isLeader, baseScore, grades } = input;

  // Vi phạm trong tuần
  const weeklyViolations = violations.filter(v =>
    isDateInRange(v.date, weekConfig.startDate, weekConfig.endDate)
  );

  // Tìm lớp của currentUser
  const userClass = classes.find(c => c.id === currentUser.className);
  const userClassName = userClass?.name || currentUser.className || '';

  // 1. Lớp không vi phạm (ưu điểm) + streak
  const classesWithViolations = new Set(
    weeklyViolations.filter(v => v.points > 0).map(v => v.classId)
  );
  // Tính streak cho mỗi lớp không vi phạm
  const perfectClassesText = classes
    .filter(c => !classesWithViolations.has(c.id))
    .map(c => {
      const streak = computeStreak(c.id, weekConfig, allWeekConfigs, violations);
      return streak > 1 ? `${c.name} (${streak})` : c.name;
    })
    .join(', ');

  // 2. Nhược điểm: nhóm theo tiêu chí → theo lớp → học sinh
  // Chỉ tính vi phạm cá nhân (có studentId) và tập thể (không có)
  interface CriteriaGroup {
    criteriaName: string;
    classLines: string[];
  }

  // criteriaId → classId → { studentCounts: Map<name, count>, collectiveCount: number }
  interface ClassData { studentCounts: Map<string, number>; collectiveCount: number; }
  const criteriaMap = new Map<string, Map<string, ClassData>>();

  weeklyViolations
    .filter(v => v.points > 0)
    .forEach(v => {
      if (!criteriaMap.has(v.criteriaId)) criteriaMap.set(v.criteriaId, new Map());
      const classMap = criteriaMap.get(v.criteriaId)!;
      if (!classMap.has(v.classId)) classMap.set(v.classId, { studentCounts: new Map(), collectiveCount: 0 });
      const classData = classMap.get(v.classId)!;
      if (v.studentId) {
        const student = students.find(s => s.id === v.studentId && s.classId === v.classId);
        if (student) {
          classData.studentCounts.set(student.name, (classData.studentCounts.get(student.name) || 0) + 1);
        }
      } else {
        classData.collectiveCount++;
      }
    });

  const criteriaGroups: CriteriaGroup[] = [];
  criteriaMap.forEach((classMap, criteriaId) => {
    const crit = criteria.find(c => c.id === criteriaId);
    const criteriaName = crit?.content || criteriaId;
    const classLines: string[] = [];
    classMap.forEach((classData, classId) => {
      const cls = classes.find(c => c.id === classId);
      const clsName = cls?.name || classId;
      // Gộp cả tập thể và cá nhân vào 1 dòng (tránh mất vi phạm khi cùng tồn tại)
      const parts: string[] = [];
      if (classData.collectiveCount > 0) {
        parts.push(classData.collectiveCount > 1 ? `Tập thể (${classData.collectiveCount} lượt)` : 'Tập thể');
      }
      classData.studentCounts.forEach((count, name) => {
        parts.push(count > 1 ? `${name} (${count} lượt)` : name);
      });
      classLines.push(`${clsName}: ${parts.join(', ')}`);
    });
    criteriaGroups.push({ criteriaName, classLines });
  });

  // Build paragraphs cho NHƯỢC ĐIỂM
  const nhuccDiemParagraphs: Paragraph[] = [];
  if (criteriaGroups.length === 0) {
    nhuccDiemParagraphs.push(para([run('- Không có nhược điểm đáng kể trong tuần này.', false, RED)]));
  } else {
    criteriaGroups.forEach(group => {
      nhuccDiemParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `${group.criteriaName}:`, bold: true, color: RED, size: 24 })],
          spacing: { before: 80, after: 40 },
        })
      );
      group.classLines.forEach(line => {
        nhuccDiemParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `  ${line}`, color: RED, size: 24 })],
            spacing: { after: 40 },
          })
        );
      });
    });
  }

  // Ranking table
  const rankingTable = buildRankingTable(classes, weeklyViolations, 1, baseScore, grades);

  // Khoảng cách sau bảng
  const afterTable = new Paragraph({ children: [], spacing: { after: 200 } });

  // ==═══════════════════════════ DOCUMENT ═════════════════════════════════
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
          },
        },
      },
      children: [
        // Tiêu đề
        mainTitle(`BÁO CÁO THI ĐUA NỀ NẾP ${weekConfig.name.toUpperCase()}`),
        subtitle(`${formatDate(weekConfig.startDate)} – ${formatDate(weekConfig.endDate)}`),

        // ==== OPENING PARAGRAPH (phân biệt LEADER vs BCH) ====
        ...(isLeader ? [
          // Lãnh đạo: lời chào mừng, không xưng em
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Kính chào Thầy/Cô `, size: 24 }),
              new TextRun({ text: currentUser.name, bold: true, size: 24 }),
              new TextRun({ text: ' đến kiểm tra công tác nề nếp thi đua nhà trường!', size: 24 }),
            ],
            spacing: { before: 120, after: 120 },
          }),
        ] : [
          // BCH / BCH_PHU_TRACH / ADMIN: giữ nguyên lời chào + giới thiệu
          para([run('Kính thưa các thầy cô giáo và các bạn học sinh!')]),
          para([
            run('Tên em là '),
            run(currentUser.name, true),
            run(', chi đoàn '),
            run(userClassName, true),
          ]),
          para([
            run(`Sau đây, đại diện Ban nề nếp, em xin báo cáo công tác nề nếp thi đua ${weekConfig.name} vừa qua như sau:`),
          ], 200),
        ]),

        // 1. ƯU ĐIỂM
        sectionHeader('1. ƯU ĐIỂM'),
        para([
          run('- Nhiều lớp thực hiện rất tốt nề nếp thi đua như lớp '),
          new TextRun({ text: perfectClassesText || 'không có lớp nào', color: RED, size: 24 }),
        ]),

        // 2. NHƯỢC ĐIỂM
        sectionHeader('2. NHƯỢC ĐIỂM'),
        ...nhuccDiemParagraphs,

        // 3. KẾT QUẢ CHẤM THI ĐUA
        sectionHeader(`3. KẾT QUẢ CHẤM THI ĐUA ${weekConfig.name.toUpperCase()}`),
        rankingTable,
        afterTable,

        // Kết luận — chỉ hiển thị với BCH/ADMIN, không dùng cho Lãnh đạo
        ...(isLeader ? [] : [
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `    Trên đây là bản báo cáo thi đua nề nếp của 36 chi đoàn ${weekConfig.name} vừa qua.`,
                size: 24,
              }),
            ],
            spacing: { before: 160, after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: '    Lời cuối, em xin kính chúc các thầy cô cùng các bạn học sinh có một tuần học mới vui vẻ và đầy thành tích tốt. Em xin cảm ơn!',
                size: 24,
              }),
            ],
          }),
        ]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `BaoCao_${weekConfig.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, fileName);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};
