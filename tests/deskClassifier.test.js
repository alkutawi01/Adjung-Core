import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeskScores, classifyDesk } from '../core/sources/DeskClassifier.js';

const mockDesks = [
  { id: 'desk-1', deskName: 'Diplomasi', enabled: 1 },
  { id: 'desk-2', deskName: 'Ekonomi', enabled: 1 },
  { id: 'desk-3', deskName: 'Nasional', enabled: 1 },
  { id: 'desk-4', deskName: 'Sukan', enabled: 1 },
  { id: 'desk-5', deskName: 'Sains & Teknologi', enabled: 1 },
  { id: 'desk-6', deskName: 'Kesihatan', enabled: 1 },
  { id: 'desk-7', deskName: 'Pendidikan', enabled: 1 }
];

const mockRules = [
  // Diplomasi
  { id: 'r1', deskId: 'desk-1', keyword: 'asean', weight: 30, isNegative: 0, enabled: 1 },
  { id: 'r2', deskId: 'desk-1', keyword: 'pbb', weight: 30, isNegative: 0, enabled: 1 },
  // Ekonomi (Aliasi)
  { id: 'r4', deskId: 'desk-2', keyword: 'bnm', weight: 45, isNegative: 0, enabled: 1 },
  { id: 'r5', deskId: 'desk-2', keyword: 'ringgit', weight: 30, isNegative: 0, enabled: 1 },
  // Nasional (Aliasi & Legal)
  { id: 'r6', deskId: 'desk-3', keyword: 'pdrm', weight: 45, isNegative: 0, enabled: 1 },
  { id: 'r7', deskId: 'desk-3', keyword: 'pasport', weight: 35, isNegative: 0, enabled: 1 },
  { id: 'r8', deskId: 'desk-3', keyword: 'imigresen', weight: 35, isNegative: 0, enabled: 1 },
  { id: 'r9', deskId: 'desk-3', keyword: 'polis', weight: 30, isNegative: 0, enabled: 1 },
  { id: 'r10', deskId: 'desk-3', keyword: 'kerajaan', weight: 20, isNegative: 0, enabled: 1 },
  // Sukan
  { id: 'r11', deskId: 'desk-4', keyword: 'atlet', weight: 40, isNegative: 0, enabled: 1 },
  { id: 'r12', deskId: 'desk-4', keyword: 'pingat', weight: 35, isNegative: 0, enabled: 1 },
  // Sains & Teknologi (Positive + Negative Exclusion Rules)
  { id: 'r13', deskId: 'desk-5', keyword: 'ai', weight: 35, isNegative: 0, enabled: 1 },
  { id: 'r14', deskId: 'desk-5', keyword: 'biometrik', weight: 35, isNegative: 0, enabled: 1 },
  { id: 'r15', deskId: 'desk-5', keyword: 'pasport', weight: 50, isNegative: 1, enabled: 1 },
  // Kesihatan (Aliasi & Domain Anchors)
  { id: 'r16', deskId: 'desk-6', keyword: 'kkm', weight: 45, isNegative: 0, enabled: 1 },
  { id: 'r17', deskId: 'desk-6', keyword: 'hospital', weight: 40, isNegative: 0, enabled: 1 },
  { id: 'r18', deskId: 'desk-6', keyword: 'doktor', weight: 35, isNegative: 0, enabled: 1 },
  // Pendidikan (Aliasi & Domain Anchors)
  { id: 'r19', deskId: 'desk-7', keyword: 'kpm', weight: 40, isNegative: 0, enabled: 1 },
  { id: 'r20', deskId: 'desk-7', keyword: 'universiti', weight: 45, isNegative: 0, enabled: 1 }
];

const mockGlobalExclusions = [
  { id: 'gex-1', keyword: 'mahkamah', penaltyWeight: 50, targetDesksExcluded: 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan', enabled: 1 },
  { id: 'gex-2', keyword: 'polis', penaltyWeight: 45, targetDesksExcluded: 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan', enabled: 1 }
];

test('DeskClassifier - classifies passport legal issue ("Lelaki Bangladesh tidak mengaku miliki 11 pasport individu lain") as NASIONAL, not Sains & Teknologi', () => {
  const item = {
    title: "Lelaki Bangladesh tidak mengaku miliki 11 pasport individu lain",
    formattedBrief: "Tertuduh dihadapkan ke Mahkamah Majistret atas pertuduhan memiliki pasport orang lain."
  };

  const result = classifyDesk(item, mockRules, mockDesks, mockGlobalExclusions);
  assert.equal(result.winningDesk, 'Nasional');
  assert.notEqual(result.winningDesk, 'Sains & Teknologi');
  assert.ok(result.topScore >= 35);
});

test('DeskClassifier - classifies hospital news ("Hospital kerajaan dinaik taraf") as Kesihatan, beating generic Nasional', () => {
  const item = {
    title: "Hospital kerajaan dinaik taraf demi pesakit",
    formattedBrief: "Kemudahan perubatan hospital awam dipertingkatkan oleh KKM."
  };

  const result = classifyDesk(item, mockRules, mockDesks, mockGlobalExclusions);
  assert.equal(result.winningDesk, 'Kesihatan');
  assert.equal(result.publicCategory, 'Kesihatan');
  assert.ok(result.topScore >= 50);
});

test('DeskClassifier - recognizes agency acronym alias PDRM as NASIONAL', () => {
  const item = {
    title: "PDRM lancar operasi keselamatan sempadan",
    formattedBrief: "Anggota keselamatan mengawal ketat laluan masuk."
  };

  const result = classifyDesk(item, mockRules, mockDesks, mockGlobalExclusions);
  assert.equal(result.winningDesk, 'Nasional');
});

test('DeskClassifier - sets publicCategory to SEMASA for unclassified items', () => {
  const item = {
    title: "Kucing comel melompat atas pagar",
    formattedBrief: "Kejadian berlaku di sebuah taman perumahan."
  };

  const result = classifyDesk(item, mockRules, mockDesks, mockGlobalExclusions);
  assert.equal(result.winningDesk, 'BELUM DIKELASKAN');
  assert.equal(result.publicCategory, 'SEMASA');
  assert.equal(result.confidence, 'LOW');
});
