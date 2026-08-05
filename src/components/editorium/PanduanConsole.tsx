import React from 'react';

// Panduan (Fasa 16, 2026-08-02) — panduan operasi harian untuk editor sebenar, bukan spesifikasi
// teknikal. Setiap dakwaan di bawah disemak terus terhadap kod semasa (EditoriumView.tsx,
// useSlotEditor.ts, server.js, IndeksConsole.tsx, TetapanConsole.tsx) sebelum ditulis — jangan
// tambah langkah/ciri yang belum wujud dalam sistem sebenar. Untuk peraturan teknikal penuh
// (had aksara, format medan, dsb.) rujuk Dokumentasi → Peraturan Am (PerlembagaanConsole.tsx);
// fail ni sengaja tidak menyalin semula nombor tersebut, cuma merujuk ke sana.

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
    {children}
  </span>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
    <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">{title}</h3>
    <div className="font-sans text-xs text-stone-600 leading-relaxed">{children}</div>
  </div>
);

export const PanduanConsole: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
        <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
          Panduan Penggunaan Editorium
        </h2>
        <p className="font-sans text-xs text-stone-600 max-w-2xl">
          Rujukan ringkas cara menulis, menerbit, dan mengurus kandungan di Adjung Brief —
          langkah demi langkah, ikut apa yang sebenarnya wujud dalam sistem hari ini. Untuk
          peraturan teknikal penuh (had aksara kad, format medan, dsb.), rujuk{' '}
          <span className="font-semibold text-stone-800">Dokumentasi → 1. Peraturan Am</span>.
        </p>
      </div>

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
            bajet ruang kad tu (lihat seksyen 02 di bawah), dan (b) Bidang serta Topik
            sudah diisi. Kalau gagal semakan, sistem tolak dan tunjuk sebab — bukan
            terbit dengan kandungan terpotong.
          </Card>
          <Card title="4. Status selepas terbit">
            Kandungan yang berjaya diterbitkan mendarat sebagai <strong>Menunggu</strong>{' '}
            (bukan terus Aktif) — perlu kelulusan Ketua Editor di <strong>Kandungan →
            Indeks</strong>. Pengecualian: slot Bar (jalur acara/program) kekal ikut
            peraturan tersendiri, lihat Dokumentasi → Peraturan Am seksyen 04.
          </Card>
          <Card title="Kelulusan di Indeks">
            Ketua Editor/Penolong semak kandungan Menunggu di <strong>Kandungan →
            Indeks</strong>, boleh Lulus (jadi Aktif, terus di frontpage) atau Tolak.
            Tolak BUKAN buang kandungan — ia pulangkan semula sebagai draf yang boleh
            disunting di Tulis Kandungan/Draf Saya.
          </Card>
          <Card title="Draf Saya">
            Senarai semua draf peribadi anda merentasi slot, dengan siapa pemiliknya
            (ditandai baris "Penulis:"). Klik mana-mana draf untuk terus buka semula
            di ruang menulis, sambung dari tempat terhenti.
          </Card>
        </div>
      </div>

      {/* 02 — BAJET RUANG KAD */}
      <div>
        <SectionLabel>02 — Kenapa Kandungan Kadang Ditolak: Bajet Ruang Kad</SectionLabel>
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

      {/* 03 — BIDANG & TOPIK */}
      <div>
        <SectionLabel>03 — Bidang &amp; Topik</SectionLabel>
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

      {/* 04 — MENGURUS SLOT SEDIA ADA */}
      <div>
        <SectionLabel>04 — Mengurus Slot Sedia Ada</SectionLabel>
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

      {/* 05 — PERANAN & KEBENARAN */}
      <div>
        <SectionLabel>05 — Peranan &amp; Kebenaran (RBAC)</SectionLabel>
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

      {/* 06 — BILA SESUATU TAK KENA */}
      <div>
        <SectionLabel>06 — Bila Sesuatu Tak Kena</SectionLabel>
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
