import React from 'react';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';

// Panduan (Fasa 16, 2026-08-02) — panduan operasi harian untuk editor sebenar, bukan spesifikasi
// teknikal. Setiap dakwaan di bawah disemak terus terhadap kod semasa (EditoriumView.tsx,
// useSlotEditor.ts, server.js, IndeksConsole.tsx, TetapanConsole.tsx) sebelum ditulis — jangan
// tambah langkah/ciri yang belum wujud dalam sistem sebenar. Untuk peraturan teknikal penuh
// (had aksara, format medan, dsb.) rujuk Dokumentasi → Peraturan Am (PerlembagaanConsole.tsx);
// fail ni sengaja tidak menyalin semula nombor tersebut, cuma merujuk ke sana.

// Kad panduan bertajuk — chrome kad (sempadan/bayang/radius) datang daripada PanelCard kongsi;
// yang tinggal di sini hanyalah corak tajuk + badan khusus muka panduan. Padding dikekalkan p-4
// (bukan lalai p-6) kerana kad rujukan di sini padat dan berbilang dalam satu grid, sama seperti
// kad peraturan Perlembagaan.
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <PanelCard padding="p-4">
    <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">{title}</h3>
    <div className="font-sans text-xs text-stone-600 leading-relaxed">{children}</div>
  </PanelCard>
);

// Carta Alir Kandungan (2026-08-06, permintaan Izzat) — status SEBENAR dalam kod
// (core/routes/contentRoutes.js CONTENT_STATUSES + runSchedulingTick): Draf (blok teks,
// TIADA baris DB — lihat draftRoutes.js) -> Menunggu ('pending') -> Aktif ('approved') ->
// Arkib ('archived'). 'rejected'/'scheduled' turut wujud dalam kod tapi bukan status HENTIAN
// yang editor nampak sendiri secara kekal — 'rejected' legasi tak pernah ditulis sesiapa
// (Tolak sebenar guna mekanisme draf-semula, lihat nota di bawah), 'scheduled' singkatan
// automatik sebelum Aktif (Jadual Terbit) jadi tak ditunjukkan sebagai kotak berasingan supaya
// carta ni kekal mudah dibaca peringkat harian, bukan spesifikasi teknikal penuh.
const CartaAlirKandungan: React.FC = () => {
  const kotak = { w: 148, h: 68 };
  const y = 118;
  const posisi = { draf: 24, menunggu: 232, aktif: 440, arkib: 648 };
  const warna = {
    draf: { bg: '#f5f5f4', border: '#a8a29e', teks: '#57534e' },
    menunggu: { bg: '#fffbeb', border: '#b45309', teks: '#92400e' },
    aktif: { bg: '#ecfdf5', border: '#065f46', teks: '#065f46' },
    arkib: { bg: '#f5f5f4', border: '#78716c', teks: '#44403c' },
  };
  const Kotak: React.FC<{ x: number; label: string; sub: string; warna: { bg: string; border: string; teks: string } }> = ({ x, label, sub, warna: w }) => (
    <g>
      <rect x={x} y={y} width={kotak.w} height={kotak.h} rx={8} fill={w.bg} stroke={w.border} strokeWidth={1.5} />
      <text x={x + kotak.w / 2} y={y + 28} textAnchor="middle" fontSize="13" fontWeight={700} fill={w.teks} fontFamily="ui-serif, Georgia, serif">{label}</text>
      <text x={x + kotak.w / 2} y={y + 46} textAnchor="middle" fontSize="9" fill={w.teks} fontFamily="ui-monospace, monospace" letterSpacing="0.03em">{sub}</text>
    </g>
  );
  return (
    <PanelCard padding="p-4" className="overflow-x-auto">
      <svg viewBox="0 0 830 320" className="w-full min-w-[700px]" style={{ maxHeight: 360 }}>
        <defs>
          <marker id="panahMaroon" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-Adjung-maroon)" />
          </marker>
          <marker id="panahMerah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#b91c1c" />
          </marker>
          <marker id="panahKelabu" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#78716c" />
          </marker>
        </defs>

        <Kotak x={posisi.draf} label="Draf" sub="TEKS SAHAJA" warna={warna.draf} />
        <Kotak x={posisi.menunggu} label="Menunggu" sub="PENDING" warna={warna.menunggu} />
        <Kotak x={posisi.aktif} label="Aktif" sub="APPROVED · DI FRONTPAGE" warna={warna.aktif} />
        <Kotak x={posisi.arkib} label="Arkib" sub="ARCHIVED" warna={warna.arkib} />

        {/* Aliran ke hadapan (maroon) — Terbitkan / Luluskan / Arkibkan */}
        <line x1={posisi.draf + kotak.w} y1={y + 34} x2={posisi.menunggu - 4} y2={y + 34} stroke="var(--color-Adjung-maroon)" strokeWidth={1.75} markerEnd="url(#panahMaroon)" />
        <text x={(posisi.draf + kotak.w + posisi.menunggu) / 2} y={y + 20} textAnchor="middle" fontSize="9.5" fill="var(--color-Adjung-maroon)" fontWeight={600}>Terbitkan</text>

        <line x1={posisi.menunggu + kotak.w} y1={y + 34} x2={posisi.aktif - 4} y2={y + 34} stroke="var(--color-Adjung-maroon)" strokeWidth={1.75} markerEnd="url(#panahMaroon)" />
        <text x={(posisi.menunggu + kotak.w + posisi.aktif) / 2} y={y + 20} textAnchor="middle" fontSize="9.5" fill="var(--color-Adjung-maroon)" fontWeight={600}>Luluskan</text>

        <line x1={posisi.aktif + kotak.w} y1={y + 34} x2={posisi.arkib - 4} y2={y + 34} stroke="var(--color-Adjung-maroon)" strokeWidth={1.75} markerEnd="url(#panahMaroon)" />
        <text x={(posisi.aktif + kotak.w + posisi.arkib) / 2} y={y + 20} textAnchor="middle" fontSize="9" fill="var(--color-Adjung-maroon)" fontWeight={600}>Arkibkan /</text>
        <text x={(posisi.aktif + kotak.w + posisi.arkib) / 2} y={y + 30} textAnchor="middle" fontSize="9" fill="var(--color-Adjung-maroon)" fontWeight={600}>Luput berjadual</text>

        {/* Gelung Tolak (merah, lengkung bawah) — Menunggu/Aktif kembali ke Draf. Titik kawalan
            kongsi X dengan hujung (bukan satu puncak di tengah) — bentuk lengkung jadi RATA
            melintasi keseluruhan lebar, bukan melengkung ke bawah cuma di tengah. Label DUA
            baris diletak SELEPAS bahagian rata tu sepenuhnya (bukan cuma bawah puncak anggapan)
            — isu ditemui semasa sahkan visual sebenar (dua percubaan pertama masih bertindih,
            baris kod ni jarak diperbesar sehingga disahkan bersih). */}
        <path d={`M ${posisi.aktif + kotak.w / 2} ${y + kotak.h} C ${posisi.aktif + kotak.w / 2} ${y + kotak.h + 70}, ${posisi.draf + kotak.w / 2} ${y + kotak.h + 70}, ${posisi.draf + kotak.w / 2} ${y + kotak.h}`} fill="none" stroke="#b91c1c" strokeWidth={1.5} strokeDasharray="4,3" markerEnd="url(#panahMerah)" />
        <text x={(posisi.draf + posisi.aktif) / 2 + kotak.w / 2} y={y + kotak.h + 92} textAnchor="middle" fontSize="9.5" fill="#b91c1c" fontWeight={600}>Tolak (sebab dicatat, kekal Menunggu selepas Terbitkan semula —</text>
        <text x={(posisi.draf + posisi.aktif) / 2 + kotak.w / 2} y={y + kotak.h + 104} textAnchor="middle" fontSize="9.5" fill="#b91c1c" fontWeight={600}>perlu kelulusan Ketua Editor/Penolong)</text>

        {/* Gelung Siarkan Semula (kelabu, lengkung atas) — Arkib kembali ke Aktif */}
        <path d={`M ${posisi.arkib + kotak.w / 2} ${y} C ${posisi.arkib + kotak.w / 2} ${y - 42}, ${posisi.aktif + kotak.w / 2} ${y - 42}, ${posisi.aktif + kotak.w / 2} ${y}`} fill="none" stroke="#78716c" strokeWidth={1.5} strokeDasharray="4,3" markerEnd="url(#panahKelabu)" />
        <text x={(posisi.aktif + posisi.arkib) / 2 + kotak.w / 2} y={y - 50} textAnchor="middle" fontSize="9.5" fill="#78716c" fontWeight={600}>Siarkan Semula (boleh pindah slot lain, Bidang sepadan)</text>
      </svg>
      <p className="font-sans text-[10px] text-stone-400 mt-1 px-1">
        Draf ialah blok teks peribadi (belum jadi rekod rasmi) — semua status lain rekod
        sebenar dalam Indeks. Aktif/Menunggu boleh diklik terus di <strong>Slot → Senarai
        Slot</strong> untuk lihat senarai tajuk + tarikh jadual (kalau ada). "Luluskan" boleh
        dibuat Editor SENDIRI atau perlu Ketua Editor/Penolong, ikut <strong>Dasar Terbit
        Sendiri Editor</strong> (Slot → 4. Tetapan Am); kandungan yang lulus tapi slot penuh
        kekal Menunggu (naik taraf automatik bila ruang terbuka) — lihat seksyen 01 di atas.
      </p>
    </PanelCard>
  );
};

export const PanduanConsole: React.FC = () => {
  return (
    <div className="space-y-8">
      <ModulTajuk
        tajuk="Panduan Penggunaan Editorium"
        huraian={
          <span className="block max-w-2xl">
            Rujukan ringkas cara menulis, menerbit, dan mengurus kandungan di Adjung Brief —
            langkah demi langkah, ikut apa yang sebenarnya wujud dalam sistem hari ini. Untuk
            peraturan teknikal penuh (had aksara kad, format medan, dsb.), rujuk{' '}
            <span className="font-semibold text-stone-800">Dokumentasi → 1. Peraturan Am</span>.
          </span>
        }
      />

      {/* 01 — ALUR KERJA TULIS/TERBIT */}
      <div>
        <SectionLabel>01 — Tulis, Simpan Draf, dan Terbit Kandungan</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="1. Buka ruang menulis">
            Klik <strong>Tulis Kandungan</strong> (butang di Paparan Utama atau menu Slot),
            pilih slot yang mahu diisi. Ruang ni ruang draf peribadi anda sahaja — kandungan
            Aktif/Menunggu sedia ada dalam slot tu tidak dipaparkan di sini.
          </Card>
          <Card title="2. Simpan sebagai draf">
            Klik <strong>Simpan sebagai draf</strong> untuk simpan kerja belum siap. Tiada
            semakan bajet ruang atau Bidang/Topik dikuatkuasakan pada peringkat ni — boleh
            simpan separuh jalan, sambung kemudian. Draf boleh dilihat semula di{' '}
            <strong>Draf Saya</strong>.
          </Card>
          <Card title="3. Terbit sekarang">
            Apabila kandungan siap, klik <strong>Terbit sekarang</strong>. Sistem akan
            menyemak dua perkara sebelum benarkan terbit: (a) tajuk + huraian muat dalam
            bajet ruang kad tu (lihat seksyen 03 di bawah), dan (b) Bidang serta Topik
            sudah diisi. Kalau gagal semakan, sistem tolak dan tunjuk sebab — bukan
            terbit dengan kandungan terpotong.
          </Card>
          <Card title="4. Status selepas terbit">
            Kandungan yang berjaya diterbitkan mendarat sebagai <strong>Menunggu</strong> (bukan
            terus Aktif). Ikut <strong>Dasar Terbit Sendiri Editor</strong> semasa (Slot → 4.
            Tetapan Am, ditetapkan Ketua Editor) — Editor SENDIRI boleh terus luluskan kandungan
            dia di Indeks (lalai), ATAU dimatikan supaya SEMUA kandungan Editor wajib lalui Ketua
            Editor/Penolong dahulu. Pengecualian: slot Bar (jalur acara/program) kekal ikut
            peraturan tersendiri, lihat Dokumentasi → Peraturan Am seksyen 04.
          </Card>
          <Card title="Kelulusan di Indeks">
            Sesiapa yang berkelayakan (Editor sendiri kalau dasar benarkan, atau Ketua
            Editor/Penolong) semak kandungan Menunggu di <strong>Kandungan → Indeks</strong>,
            boleh Lulus (jadi Aktif) atau Tolak. Kandungan yang PERNAH ditolak sekali sentiasa
            wajib lalui Ketua Editor/Penolong untuk terbit semula, tak kira dasar terbit sendiri
            — lihat seksyen 02 (Carta Alir) di atas. Tolak BUKAN buang kandungan — ia pulangkan
            semula sebagai draf yang boleh disunting di Tulis Kandungan/Draf Saya.
          </Card>
          <Card title="Menunggu semakan vs menunggu slot kosong">
            "Lulus" tak semestinya terus jadikan kandungan Aktif — kalau slot dah penuh (Had
            Bilangan Kandungan, Tetapan Am Slot), kandungan tu kekal Menunggu dengan status
            "sudah lulus, tunggu slot kosong". Ia naik taraf ke Aktif SECARA AUTOMATIK sebaik
            ruang terbuka (kandungan lain diarkibkan/ditolak/luput) — tiada tindakan manusia
            kedua diperlukan. Lihat status ni terus di <strong>Slot → Senarai Slot</strong>
            (klik angka Menunggu).
          </Card>
          <Card title="Draf Saya">
            Senarai semua draf peribadi anda merentasi slot, dengan siapa pemiliknya
            (ditandai baris "Penulis:"). Klik mana-mana draf untuk terus buka semula
            di ruang menulis, sambung dari tempat terhenti.
          </Card>
        </div>
      </div>

      {/* 02 — CARTA ALIR KANDUNGAN (2026-08-06, permintaan Izzat) */}
      <div>
        <SectionLabel>02 — Carta Alir Kandungan: Draf sampai Arkib</SectionLabel>
        <CartaAlirKandungan />
      </div>

      {/* 03 — BAJET RUANG KAD */}
      <div>
        <SectionLabel>03 — Kenapa Kandungan Kadang Ditolak: Bajet Ruang Kad</SectionLabel>
        <Card title="Satu bajet, dua medan">
          <>
            Setiap kad bento (Hero, Menegak, Standard, dll.) ada saiz fizikal tetap — kad
            TAK boleh melimpah. Tajuk dan huraian satu kad berkongsi SATU bajet ruang, bukan
            dua had berasingan: tajuk panjang + huraian pendek boleh muat, huraian panjang +
            tajuk pendek pun boleh — tapi kedua-duanya panjang serentak tak boleh. Sistem
            semak ini secara automatik semasa Simpan/Terbit; kalau tak muat, ia tolak dan
            minta anda pendekkan salah satu medan sendiri — sistem TIDAK memotong tulisan
            anda secara automatik.
            <br /><br />
            Had sebenar berbeza ikut saiz/tier kad (kad besar macam Hero lapang lebih
            berbanding kad kecil macam Kompak). Untuk lihat had tepat setiap tier serta
            carta visual saiz kad, rujuk <strong>Dokumentasi → 1. Peraturan Am</strong>{' '}
            (carta dijana terus daripada nombor sebenar sistem, sentiasa terkini).
          </>
        </Card>
      </div>

      {/* 04 — BIDANG & TOPIK */}
      <div>
        <SectionLabel>04 — Bidang &amp; Topik</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Bidang terkunci per-slot">
            Setiap slot (kecuali Ticker dan tier Bar) terkunci kepada SATU Bidang tetap
            (cth. Ekonomi, Kebudayaan) — semua kandungan dalam slot tu, termasuk semua
            item carousel, mesti dalam Bidang yang sama. Bidang slot boleh ditukar bila-bila
            masa di <strong>Slot → 3. Bidang</strong>, tapi pertukaran itu tidak retroaktif —
            hanya kandungan baharu selepas perubahan ikut Bidang baharu.
          </Card>
          <Card title="Topik bebas per-kandungan">
            Topik pula medan bebas, boleh berbeza-beza dalam slot yang sama asalkan masih
            dalam Bidang terkunci tu (cth. Bidang Ekonomi tetap, Topik boleh Kewangan/
            Perbankan/dll.). Topik wajib diisi untuk kandungan baharu atau yang diedit —
            kandungan lama tanpa Topik kekal seadanya, tiada migrasi paksa.
          </Card>
        </div>
      </div>

      {/* 05 — MENGURUS SLOT SEDIA ADA */}
      <div>
        <SectionLabel>05 — Mengurus Slot Sedia Ada</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Senarai Slot">
            <strong>Slot → 1. Senarai Slot</strong> — senarai semua 38 slot bento, tunjuk
            slot mana kosong/terisi, Bidang semasa, dan editor yang ditugaskan. Dari sini
            boleh buka <strong>Tetapan Kad</strong> untuk sunting kandungan sedia ada slot
            tertentu terus (bukan melalui Tulis Kandungan/draf).
          </Card>
          <Card title="Tier Kad">
            <strong>Slot → 2. Tier Kad</strong> — rujukan/tetapan geometri tier (saiz kad,
            had aksara) untuk pentadbir yang perlu laraskan bajet ruang sesuatu tier.
          </Card>
        </div>
      </div>

      {/* 06 — PERANAN & KEBENARAN */}
      <div>
        <SectionLabel>06 — Peranan &amp; Kebenaran (RBAC)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Pentadbir">
            Domain teknikal: Direktori (urus akaun), Tetapan Sistem, dan Kawalan Akses.
            BUKAN automatik dapat kuasa editorial (lulus/tolak kandungan) melainkan akaun
            sama turut dilantik sebagai Ketua Editor/Penolong.
          </Card>
          <Card title="Ketua Editor">
            Kuasa editorial penuh (lulus/tolak semua kandungan, urus semua slot) DAN
            satu-satunya peranan yang boleh menulis <strong>Nota Ketua Editor</strong>.
            Peranan pentadbir urus (immutable) — kuasa teras editorial tak boleh ditarik
            semula daripada akaun sendiri.
          </Card>
          <Card title="Penolong/Timbalan Ketua Editor">
            Kongsi kuasa editorial penuh yang sama dengan Ketua Editor (lulus/tolak,
            urus semua slot), KECUALI Nota Ketua Editor (Ketua Editor sahaja) dan urus
            akaun (Pentadbir sahaja).
          </Card>
          <Card title="Editor">
            Peranan asas — tulis dan terbit kandungan (mendarat sebagai Menunggu,
            tunggu kelulusan). TIDAK boleh tugaskan/tanggalkan editor pada slot (Ketua
            Editor/Penolong sahaja, kunci <em>Agihan Slot</em>) dan TIDAK boleh baca
            Log Sistem (lihat 06 di bawah).
          </Card>
        </div>
        <p className="font-sans text-[10px] text-stone-400 mt-2">
          Satu akaun boleh pegang lebih daripada satu peranan serentak. Butiran penuh
          matriks kebenaran: <strong>Tetapan → Kawalan Akses</strong> (Pentadbir sahaja).
        </p>
      </div>

      {/* 07 — BILA SESUATU TAK KENA */}
      <div>
        <SectionLabel>07 — Bila Sesuatu Tak Kena</SectionLabel>
        <Card title="Log Sistem">
          Kalau kandungan hilang tiba-tiba, simpanan gagal, atau tindakan tak seperti
          dijangka — semak <strong>Log Sistem</strong> (nav bawah, kumpulan Rujukan).
          Ia papar jejak audit sebenar daripada pangkalan data (siapa buat apa, bila) —
          bukan log teknikal pelayan. Khusus untuk <strong>Pentadbir/Ketua Editor/
          Penolong Ketua Editor</strong> (2026-08-05) — Editor biasa tak nampak destinasi
          ni langsung dalam nav; kalau perlu semak jejak, minta Ketua Editor/Pentadbir.
        </Card>
      </div>
    </div>
  );
};

export default PanduanConsole;
