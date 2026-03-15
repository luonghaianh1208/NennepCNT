import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  convertInchesToTwip, TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';
import { Violation, ClassEntity, Student, Criteria, TimeConfig, User } from '../types';
import { calculateScore, isDateInRange } from '../utils';

interface ReportInput {
  weekConfig: TimeConfig;           // Tuần được chọn
  allWeekConfigs: TimeConfig[];     // Tất cả cấu hình tuần (để tính streak)
  violations: Violation[];          // Toàn bộ vi phạm
  classes: ClassEntity[];           // Danh sách lớp
  students: Student[];              // Danh sách học sinh
  criteria: Criteria[];             // Tiêu chí
  currentUser: User;                // Người xuất file
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

/** Tạo bảng xếp hạng 9 cột */
const buildRankingTable = (
  classes: ClassEntity[],
  relevantViolations: Violation[],
  weeksCount: number,
): Table => {
  const grades: (10 | 11 | 12)[] = [12, 11, 10];
  const columnHeaders = [
    'Lớp K12', 'Điểm', 'Hạng', 
    'Lớp K11', 'Điểm', 'Hạng',
    'Lớp K10', 'Điểm', 'Hạng',
  ];

  // Xếp hạng từng khối
  const ranked: Record<number, { name: string; score: number; rank: number }[]> = {};
  grades.forEach(grade => {
    const gradeClasses = classes.filter(c => Number(c.grade) === grade);
    const stats = gradeClasses.map(cls => {
      const clsV = relevantViolations.filter(v => v.classId === cls.id);
      const score = calculateScore(clsV, 500, weeksCount, false);
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

  const maxRows = Math.max(ranked[12].length, ranked[11].length, ranked[10].length);

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
    [12, 11, 10].forEach(grade => {
      const item = ranked[grade][i];
      cells.push(cellStyle(item?.name || '', false));
      cells.push(cellStyle(item ? String(item.score) : '', false));
      cells.push(cellStyle(item ? String(item.rank) : '', false));
    });
    return new TableRow({ children: cells });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [1800, 800, 700, 1800, 800, 700, 1800, 800, 700],
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
  const { weekConfig, allWeekConfigs, violations, classes, students, criteria, currentUser } = input;

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

  const criteriaMap = new Map<string, Map<string, string[]>>(); // criteriaId → classId → [studentNames]

  weeklyViolations
    .filter(v => v.points > 0)
    .forEach(v => {
      if (!criteriaMap.has(v.criteriaId)) criteriaMap.set(v.criteriaId, new Map());
      const classMap = criteriaMap.get(v.criteriaId)!;
      if (!classMap.has(v.classId)) classMap.set(v.classId, []);
      if (v.studentId) {
        const student = students.find(s => s.id === v.studentId);
        if (student) classMap.get(v.classId)!.push(student.name);
      }
    });

  const criteriaGroups: CriteriaGroup[] = [];
  criteriaMap.forEach((classMap, criteriaId) => {
    const crit = criteria.find(c => c.id === criteriaId);
    const criteriaName = crit?.content || criteriaId;
    const classLines: string[] = [];
    classMap.forEach((studentNames, classId) => {
      const cls = classes.find(c => c.id === classId);
      const clsName = cls?.name || classId;
      if (studentNames.length > 0) {
        classLines.push(`${clsName}: ${studentNames.join(', ')}`);
      } else {
        classLines.push(`${clsName}`);
      }
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
  const rankingTable = buildRankingTable(classes, weeklyViolations, 1);

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

        // Phần mở đầu
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

        // Kết luận
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
