import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassEntity, Criteria, Student, TimeConfig, User, Violation } from '../types';

// saveAs mở hộp thoại tải file của trình duyệt — chặn lại, chỉ giữ nội dung
const saved: { blob: Blob; name: string }[] = [];
vi.mock('file-saver', () => ({
  saveAs: (blob: Blob, name: string) => { saved.push({ blob, name }); },
  default: { saveAs: (blob: Blob, name: string) => { saved.push({ blob, name }); } },
}));

const week: TimeConfig = { id: 'W1', name: 'Tuần 1', type: 'WEEK', startDate: '2026-09-07', endDate: '2026-09-13' };

const classesOf = (grades: number[]): ClassEntity[] =>
  grades.flatMap(g => [1, 2].map(i => ({
    id: `${g}A${i}`, name: `${g}A${i}`, grade: g, homeroomTeacher: `GVCN ${g}A${i}`,
  })));

const criteria: Criteria[] = [{ id: 'C1', content: 'Đi học muộn', points: 5, type: 'MINUS' }];
const students: Student[] = [{ id: 'S1', name: 'Nguyễn Văn A', classId: '10A1' }];
const currentUser: User = { id: 'U1', name: 'Quản trị', username: 'admin', role: 'ADMIN' };

const violations: Violation[] = [
  { id: 'V1', date: '2026-09-08', classId: '10A1', studentId: 'S1', criteriaId: 'C1',
    points: 5, reportedBy: 'U1', isSecurityReport: false, timestamp: 1 },
];

describe('báo cáo tuần đi theo quy định của trường', () => {
  beforeEach(() => { saved.length = 0; });

  const run = async (grades: string[], baseScore: number) => {
    const { generateWeeklyReport } = await import('./reportGenerator');
    await generateWeeklyReport({
      weekConfig: week, allWeekConfigs: [week], violations,
      classes: classesOf(grades.map(Number)), students, criteria,
      currentUser, isLeader: false, baseScore, grades,
    });
    return saved[0];
  };

  it('trường ba khối như cũ vẫn xuất được', async () => {
    const file = await run(['10', '11', '12'], 500);
    expect(file.name).toContain('.docx');
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it('trường liên cấp bốn khối 6-9 không làm vỡ bảng xếp hạng', async () => {
    // Trước khi sửa, hàm đọc thẳng ranked[12] nên trường không có khối 12 là nổ
    const file = await run(['6', '7', '8', '9'], 100);
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it('trường chỉ có một khối vẫn xuất được', async () => {
    const file = await run(['10'], 200);
    expect(file.blob.size).toBeGreaterThan(0);
  });
});
