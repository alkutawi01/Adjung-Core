import React from 'react';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';

// Panduan (tulis semula dari kosong, 2026-08-09, audit ChatGPT). Ditulis dari sudut pandang
// Editor baharu yang tiada latar belakang sistem langsung — bukan spesifikasi teknikal, bukan
// "cheat sheet" untuk orang yang dah faham. Setiap dakwaan di bawah disemak terus terhadap kod
// semasa (LengkapkanProfilModal.tsx, EditoriumLayout.tsx, contentRoutes.js, slotsConfigRoutes.js,
// SlotManagerModal.tsx, useSlotEditor.ts, DrafSayaConsole.tsx, IndeksConsole.tsx,
// SenaraiSlotConsole.tsx, TetapanAmSlotConsole.tsx) sebelum ditulis — jangan tambah langkah/ciri
// yang belum wujud dalam sistem sebenar. Untuk peraturan teknikal penuh (had aksara, format
// medan, dsb.) rujuk Dokumentasi → Peraturan Am (PerlembagaanConsole.tsx); fail ni sengaja tidak
// menyalin semula nombor tersebut, cuma merujuk ke sana.

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <PanelCard padding="p-4">
    <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">{title}</h3>
    <div className="font-sans text-xs text-stone-600 leading-relaxed">{children}</div>
  </PanelCard>
);

const Kamus: React.FC<{ istilah: string; maksud: React.ReactNode }> = ({ istilah, maksud }) => (
  <div className="grid grid-cols-[minmax(120px,auto)_1fr] gap-3 py-2 border-b border-stone-100 last:border-0">
    <dt className="font-mono text-[11px] font-bold text-stone-800 uppercase tracking-wide">{istilah}</dt>
    <dd className="font-sans text-xs text-stone-600 leading-relaxed">{maksud}</dd>
  </div>
);

export const PanduanConsole: React.FC = () => {
  return (
    <div className="space-y-8">
      <ModulTajuk
        tajuk="Panduan Penggunaan Editorium"
        huraian={
          <span className="block max-w-2xl">
            Panduan lengkap untuk Editor baharu — dari log masuk pertama sehingga kandungan
            anda tersiar. Baca ikut turutan seksyen kalau ini kali pertama anda guna sistem
            ni. Untuk peraturan teknikal penuh (had aksara kad, format medan, dsb.), rujuk{' '}
            <span className="font-semibold text-stone-800">Dokumentasi → 1. Peraturan Am</span>.
          </span>
        }
      />

      {/* 00 — SELAMAT DATANG */}
      <div>
        <SectionLabel>00 — Selamat Datang</SectionLabel>
        <Card title="Apa Adjung Brief">
          Adjung Brief ialah portal berita/kandungan yang memaparkan kandungan editorial —
          berita, ilmu, kebudayaan — dalam bentuk kad-kad bersaiz berbeza (bento grid) di
          muka depan. Sebagai Editor, kerja anda ialah menulis kandungan, menghantarnya untuk
          disemak, dan mengurus kandungan yang sudah tersiar dalam slot yang ditugaskan
          kepada anda. Panduan ni akan bawa anda dari log masuk pertama sampai kandungan
          pertama anda tersiar.
        </Card>
      </div>

      {/* 01 — HARI PERTAMA ANDA */}
      <div>
        <SectionLabel>01 — Hari Pertama Anda</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="1. Lengkapkan profil (wajib)">
            Kali pertama log masuk, satu tetingkap akan muncul meminta Nama Penuh, Kelulusan
            (nama kursus, universiti, tahun graduasi), Negeri Menetap, dan Nombor Telefon —
            semua wajib diisi. Tetingkap ni <strong>tiada butang tutup, tiada Escape</strong> —
            anda tidak boleh langkau atau tunda langkah ni. Sistem tidak akan benarkan anda
            masuk ke Editorium sehingga profil lengkap.
          </Card>
          <Card title="2. Baca dan setuju Syarat & Peraturan Editor">
            Dalam tetingkap yang sama, teks Syarat & Peraturan Editor dipaparkan untuk dibaca.
            Tandakan kotak "Saya telah membaca dan bersetuju" — butang "Sahkan & Teruskan"
            hanya aktif selepas semua medan profil diisi DAN kotak ini ditanda.
          </Card>
          <Card title="3. Kenali empat kumpulan menu">
            Selepas profil lengkap, anda akan nampak sisi navigasi Editorium disusun dalam 4
            kumpulan: <strong>Utama</strong> (Paparan Utama), <strong>Penerbitan</strong> (Draf
            Saya, Kandungan, Slot, Modul Khas, Editorial), <strong>Pengurusan</strong> (Nota
            Ketua Editor, Direktori, Tetapan), dan <strong>Rujukan</strong> (Panduan,
            Dokumentasi, Log Sistem). Sebagai Editor biasa, sesetengah destinasi dalam
            Pengurusan dan Rujukan tidak akan kelihatan pada menu anda — lihat seksyen 11 di
            bawah untuk sebab.
          </Card>
          <Card title="4. Semak slot yang ditugaskan kepada anda">
            Pergi ke <strong>Direktori</strong> atau tanya Ketua Editor/Penolong untuk tahu
            slot mana yang menjadi tanggungjawab anda — hanya Ketua Editor/Penolong boleh
            tugaskan/tanggalkan editor pada slot. Setiap slot terkunci kepada satu Bidang
            tetap (cth. Ekonomi, Kebudayaan) — lihat seksyen 03.
          </Card>
        </div>
      </div>

      {/* 02 — KENALI EDITORIUM */}
      <div>
        <SectionLabel>02 — Kenali Editorium</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Draf Saya">
            Senarai semua draf peribadi anda merentasi slot — di sinilah anda semak kerja
            belum siap, atau kandungan yang baru sahaja ditolak Ketua Editor (ia kembali ke
            sini sebagai draf, bukan hilang). Klik "Sambung" untuk terus buka semula di ruang
            menulis.
          </Card>
          <Card title="Kandungan → Indeks">
            Senarai penuh SEMUA kandungan (Aktif, Menunggu, Arkib) merentasi seluruh sistem —
            bukan cuma slot anda. Kalau anda ada kebenaran terbit sendiri, di sinilah anda
            luluskan/tolak kandungan Menunggu.
          </Card>
          <Card title="Slot → Senarai Slot">
            Senarai semua 38 slot bento — status terisi/kosong, Bidang semasa, editor
            ditugaskan, dan bilangan kandungan Menunggu bagi setiap slot (klik angka tu untuk
            lihat senarai penuh).
          </Card>
          <Card title="Modul Khas & Editorial">
            Modul Khas: ruang untuk jenis kandungan tersendiri di luar slot bento biasa.
            Editorial: alat sokongan penulisan (Autocondong, Glosari, Templat AI) — hanya
            kelihatan untuk Ketua Editor/Penolong.
          </Card>
        </div>
      </div>

      {/* 03 — FAHAMI STRUKTUR KANDUNGAN */}
      <div>
        <SectionLabel>03 — Fahami Struktur Kandungan: Bidang &amp; Topik</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Bidang terkunci per-slot">
            Setiap slot (kecuali Ticker dan tier Bar) terkunci kepada SATU Bidang tetap
            (cth. Ekonomi, Kebudayaan). Semua kandungan yang anda tulis untuk slot tu mesti
            dalam Bidang yang sama — anda tidak pilih Bidang setiap kali menulis, ia sudah
            ditetapkan pada slot.
          </Card>
          <Card title="Topik bebas, tapi wajib diisi">
            Topik pula medan bebas yang anda isi sendiri setiap kali menulis kandungan baharu
            — boleh berbeza-beza dalam slot yang sama asalkan masih dalam Bidang terkunci tu
            (cth. Bidang Ekonomi tetap, Topik boleh Kewangan/Perbankan/dll.). Topik wajib
            diisi — sistem akan tolak simpanan kalau kosong.
          </Card>
        </div>
      </div>

      {/* 04 — MENULIS KANDUNGAN */}
      <div>
        <SectionLabel>04 — Menulis Kandungan</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="1. Buka ruang menulis">
            Klik <strong>Tulis Kandungan</strong>, pilih slot yang mahu diisi. Ruang ni ruang
            draf peribadi anda — kandungan Aktif/Menunggu sedia ada dalam slot tu tidak
            dipaparkan di sini, ia tidak terjejas sehingga anda benar-benar terbitkan draf
            baharu.
          </Card>
          <Card title="2. Medan yang perlu diisi">
            <strong>Topik</strong> (wajib), <strong>Tajuk</strong> (wajib), <strong>Huraian
            ringkas</strong> (wajib), <strong>Huraian panjang</strong> (pilihan — tapi kalau
            diisi, ada had MINIMUM aksara, tak boleh separuh jalan), <strong>Sumber</strong>{' '}
            (boleh lebih daripada satu), <strong>Jenis sumber</strong>, <strong>Tarikh
            sumber</strong>, <strong>Imej</strong> (muat naik atau URL), dan <strong>Nota</strong>{' '}
            (pilihan, ruang untuk catatan dalaman). Nama anda dicatat automatik sebagai
            Penulis — tak perlu diisi.
          </Card>
          <Card title="3. Perhati Bajet Ruang semasa menaip">
            Petak biru/hijau di bawah borang menunjukkan peratus ruang kad yang digunakan —
            lihat seksyen 08 untuk maksud penuh warna dan angka ni.
          </Card>
          <Card title="4. Simpan sebagai draf">
            Klik <strong>Simpan sebagai draf</strong> untuk simpan kerja belum siap. Bajet
            ruang dan Bidang/Topik TIDAK dikuatkuasakan pada peringkat draf — boleh simpan
            separuh jalan, sambung kemudian di <strong>Draf Saya</strong>.
          </Card>
        </div>
      </div>

      {/* 05 — DRAF SAYA */}
      <div>
        <SectionLabel>05 — Draf Saya</SectionLabel>
        <Card title="Apa yang anda nampak dan boleh buat">
          Draf Saya senaraikan semua draf peribadi anda merentasi slot — setiap baris tunjuk
          slot, tier kad, Bidang, Topik, tajuk (atau "Draf kosong" kalau belum ditulis), status
          kelengkapan (ada/tiada Topik, ada huraian panjang atau ringkas sahaja), dan status
          Bajet Ruang (Lulus / Kurang bajet / Lebih had). Klik <strong>Sambung</strong> untuk
          terus buka draf tu semula di ruang menulis dan teruskan dari mana anda berhenti.
          Draf yang ditanda "Ikut slot" (bukan "Ikut nama anda") ialah draf lama yang tiada
          rekod penulis asal — ia dipaparkan ikut slot sebagai gantian. Tiada butang Terbit
          atau Padam di sini — kedua-dua tindakan tu hanya boleh dibuat di dalam ruang menulis
          slot itu sendiri (SlotManagerModal), sebab di sanalah sistem nampak SEMUA draf lain
          yang berkongsi slot yang sama.
        </Card>
      </div>

      {/* 06 — MENERBITKAN KANDUNGAN */}
      <div>
        <SectionLabel>06 — Menerbitkan Kandungan</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Terbit sekarang">
            Apabila kandungan siap, klik <strong>Terbit sekarang</strong>. Sistem semak dua
            perkara sebelum benarkan: (a) tajuk + huraian muat dalam bajet ruang kad tu, dan
            (b) Bidang serta Topik sudah diisi. Kalau gagal semakan, sistem TOLAK dan tunjuk
            sebab — kandungan tidak dihantar langsung, tiada terbit dengan teks terpotong.
          </Card>
          <Card title="Terbit Semua">
            Kalau slot anda ada beberapa draf sekaligus, butang <strong>Terbit Semua</strong>{' '}
            akan hantar semua draf yang LULUS bajet ruang dalam satu tindakan. Draf yang gagal
            semakan tidak dihantar — ia kekal sebagai draf, dan senarai sebab kegagalan
            dipaparkan supaya anda tahu apa perlu dibaiki.
          </Card>
          <Card title="Status selepas hantar: bukan terus Aktif">
            Kandungan yang berjaya dihantar TIDAK terus jadi Aktif di muka depan — ia mendarat
            sebagai <strong>Menunggu</strong> dahulu. Ada 4 kemungkinan hasil akhir; lihat
            seksyen 07 di bawah untuk penjelasan setiap satu.
          </Card>
          <Card title="Dasar Terbit Sendiri Editor">
            Sama ada anda sendiri boleh luluskan kandungan anda, atau perlu tunggu Ketua
            Editor/Penolong, bergantung kepada satu suis yang ditetapkan Ketua Editor di{' '}
            <strong>Tetapan → Tetapan Am Slot</strong> ("Dasar Terbit Sendiri Editor"). Tanya
            Ketua Editor/Penolong anda kalau tak pasti dasar semasa. Pengecualian: kandungan
            yang PERNAH ditolak sekali WAJIB lalui Ketua Editor/Penolong untuk terbit semula,
            tak kira dasar semasa. Slot Bar (jalur acara/program) turut ikut peraturan
            tersendiri — lihat Dokumentasi → Peraturan Am seksyen 04.
          </Card>
        </div>
      </div>

      {/* 07 — EMPAT STATUS SELEPAS HANTAR */}
      <div>
        <SectionLabel>07 — "Terbit" Bukan "Aktif": Empat Kemungkinan Status</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Menunggu Semakan">
            Kandungan anda perlu kelulusan manusia (anda sendiri jika dasar benarkan, atau
            Ketua Editor/Penolong) sebelum tersiar. Semak status ni di{' '}
            <strong>Kandungan → Indeks</strong>.
          </Card>
          <Card title="Menunggu Slot Kosong">
            Kandungan anda SUDAH lulus semakan, tapi slot tu sudah penuh (had bilangan
            kandungan tercapai). Ia akan naik taraf ke Aktif SECARA AUTOMATIK sebaik ruang
            terbuka (kandungan lain diarkibkan/ditolak/luput) — tiada tindakan tambahan
            diperlukan daripada anda. Lihat status ni di <strong>Slot → Senarai Slot</strong>{' '}
            (klik angka Menunggu bagi slot berkenaan).
          </Card>
          <Card title="Aktif">
            Kandungan anda sudah tersiar di muka depan. Boleh disemak bila-bila di{' '}
            <strong>Kandungan → Indeks</strong> atau <strong>Slot → Senarai Slot</strong>.
          </Card>
          <Card title="Ditolak — lihat seksyen 08">
            Kandungan tidak diluluskan. Ia TIDAK hilang — ia kembali kepada anda sebagai draf
            boleh sunting.
          </Card>
        </div>
      </div>

      {/* 08 — JIKA KANDUNGAN DITOLAK */}
      <div>
        <SectionLabel>08 — Jika Kandungan Anda Ditolak</SectionLabel>
        <Card title="Apa berlaku dan apa perlu anda buat">
          Tolak BUKAN buang kandungan. Apabila Ketua Editor/Penolong menolak kandungan anda,
          ia dipulangkan semula sebagai draf boleh sunting — cari di <strong>Draf Saya</strong>{' '}
          (ditandakan dengan nama anda sebagai Penulis). Sebab penolakan (kalau dicatat oleh
          penyemak) akan kelihatan dalam medan Nota draf tu apabila anda buka semula. Baiki
          isu yang disebut, kemudian hantar semula ikut langkah di seksyen 06. Ambil perhatian:
          kandungan yang PERNAH ditolak sekali akan sentiasa wajib lalui semakan Ketua
          Editor/Penolong bila dihantar semula — walaupun dasar terbit sendiri anda dibenarkan.
        </Card>
      </div>

      {/* 09 — BAJET RUANG KAD */}
      <div>
        <SectionLabel>09 — Bajet Ruang Kad</SectionLabel>
        <Card title="Satu bajet, dua medan — dan apa maksud warna petak">
          <>
            Setiap kad bento (Hero, Menegak, Standard, dll.) ada saiz fizikal tetap — kad TAK
            boleh melimpah. Tajuk dan huraian satu kad berkongsi SATU bajet ruang, bukan dua
            had berasingan: tajuk panjang + huraian pendek boleh muat, huraian panjang + tajuk
            pendek pun boleh — tapi kedua-duanya panjang serentak tak boleh.
            <br /><br />
            Petak Bajet Ruang di ruang menulis tunjuk peratus ruang digunakan, dengan tiga
            warna: <strong className="text-emerald-700">hijau</strong> (selamat, di bawah 90%),{' '}
            <strong className="text-amber-700">kuning/ambar</strong> (hampir penuh, di atas 90%
            tapi masih muat — sempat dihantar), dan <strong style={{ color: '#a8241f' }}>merah</strong>{' '}
            (TIDAK muat — sama ada terlalu panjang, atau kalau huraian panjang diisi, mungkin
            terlalu pendek daripada had minimum). Pada warna merah, sistem tunjuk panduan
            ringkas sama ada perlu panjangkan atau pendekkan kandungan.
            <br /><br />
            Pada warna merah, <strong>butang Terbit tidak akan berfungsi</strong> — sistem
            menyekat penghantaran, bukan sekadar beri amaran. Anda perlu edit tajuk/huraian
            sendiri sehingga petak jadi hijau/kuning sebelum boleh terbit. Sistem TIDAK
            memotong tulisan anda secara automatik.
            <br /><br />
            Had sebenar berbeza ikut saiz/tier kad (kad besar macam Hero lapang lebih
            berbanding kad kecil macam Kompak). Untuk lihat had tepat setiap tier serta carta
            visual saiz kad, rujuk <strong>Dokumentasi → 1. Peraturan Am</strong>.
          </>
        </Card>
      </div>

      {/* 10 — MENGURUS KANDUNGAN ANDA */}
      <div>
        <SectionLabel>10 — Mengurus Kandungan Anda</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Senarai Slot">
            <strong>Slot → 1. Senarai Slot</strong> — senarai semua 38 slot bento, tunjuk slot
            mana kosong/terisi, Bidang semasa, dan editor yang ditugaskan. Dari sini boleh
            buka <strong>Tetapan Kad</strong> untuk sunting kandungan sedia ada slot tertentu
            terus (bukan melalui Tulis Kandungan/draf).
          </Card>
          <Card title="Tier Kad">
            <strong>Slot → 2. Tier Kad</strong> — rujukan geometri tier (saiz kad, had aksara)
            untuk yang perlu laraskan bajet ruang sesuatu tier. Biasanya bukan urusan Editor
            harian.
          </Card>
        </div>
      </div>

      {/* 11 — JIKA SESUATU TIDAK BERJALAN */}
      <div>
        <SectionLabel>11 — Jika Sesuatu Tidak Berjalan</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title='"Slot ni telah disimpan oleh orang lain"'>
            Mesej merah ni muncul kalau ada editor/Ketua Editor lain menyimpan slot yang sama
            selepas anda membukanya. Kerja anda dalam borang TIDAK hilang serta-merta — ruang
            menulis kekal terbuka. Salin dahulu apa yang anda taip (secara manual) sebelum
            tutup, kemudian buka semula slot tu supaya anda dapat versi terkini, dan masukkan
            semula kandungan anda dari situ. Sistem belum gabungkan perubahan secara automatik.
          </Card>
          <Card title="Simpanan gagal / kandungan hilang">
            Semak dahulu Bajet Ruang dan medan Topik/Bidang — punca paling biasa ialah salah
            satu daripada dua semakan tu gagal senyap. Kalau masih tak pasti, atau kandungan
            yang sepatutnya ada tiba-tiba hilang, minta Ketua Editor/Penolong semak{' '}
            <strong>Log Sistem</strong> (destinasi ni khusus untuk Pentadbir/Ketua
            Editor/Penolong — Editor biasa tak nampak dalam menu sendiri).
          </Card>
          <Card title="Tak pasti kenapa kandungan ditolak">
            Buka draf tu di <strong>Draf Saya</strong> — sebab penolakan (kalau dicatat)
            tertera dalam medan Nota. Kalau tiada catatan, tanya terus Ketua Editor/Penolong
            yang menolak.
          </Card>
          <Card title="Bila perlu hubungi Ketua Editor/Penolong">
            Untuk: tugaskan/tanggalkan editor pada slot, tukar Bidang slot, tukar Dasar Terbit
            Sendiri Editor, semak Log Sistem, atau apa-apa keputusan yang di luar kebenaran
            Editor (seksyen 12). Untuk isu teknikal berulang, laporkan kepada Pentadbir.
          </Card>
        </div>
      </div>

      {/* 12 — PERANAN & HAD ANDA */}
      <div>
        <SectionLabel>12 — Peranan &amp; Had Anda (RBAC)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="Editor (peranan anda, lazimnya)">
            Boleh: tulis dan terbit kandungan untuk slot yang ditugaskan, urus draf sendiri,
            luluskan kandungan sendiri JIKA dasar terbit sendiri dibenarkan. TIDAK boleh:
            tugaskan/tanggalkan editor pada slot mana-mana (kunci Agihan Slot, Ketua
            Editor/Penolong sahaja), baca Log Sistem, akses Direktori/Tetapan (Pentadbir
            sahaja), atau tulis Nota Ketua Editor.
          </Card>
          <Card title="Ketua Editor & Penolong/Timbalan">
            Kuasa editorial penuh — lulus/tolak SEMUA kandungan (bukan cuma slot sendiri),
            urus semua slot, tetapkan Dasar Terbit Sendiri Editor, baca Log Sistem. Ketua
            Editor sahaja yang boleh menulis Nota Ketua Editor.
          </Card>
          <Card title="Pentadbir">
            Domain teknikal: Direktori (urus akaun), Tetapan Sistem, Kawalan Akses. BUKAN
            automatik dapat kuasa editorial (lulus/tolak kandungan) melainkan akaun sama turut
            dilantik sebagai Ketua Editor/Penolong.
          </Card>
          <Card title="Satu akaun, banyak peranan">
            Satu akaun boleh pegang lebih daripada satu peranan serentak. Butiran penuh
            matriks kebenaran: <strong>Tetapan → Kawalan Akses</strong> (Pentadbir sahaja).
          </Card>
        </div>
      </div>

      {/* 13 — KAMUS ADJUNG BRIEF */}
      <div>
        <SectionLabel>13 — Kamus Adjung Brief</SectionLabel>
        <PanelCard padding="p-4">
          <dl>
            <Kamus istilah="Slot" maksud="Satu daripada 38 ruang kad tetap di muka depan (+ Ticker). Setiap slot terkunci kepada satu Bidang." />
            <Kamus istilah="Bidang" maksud="Kategori tetap satu slot (cth. Ekonomi, Kebudayaan) — semua kandungan dalam slot tu mesti sepadan." />
            <Kamus istilah="Topik" maksud="Sub-label bebas per-kandungan dalam Bidang yang sama, wajib diisi setiap kali menulis." />
            <Kamus istilah="Draf" maksud="Kerja belum siap/belum dihantar — hanya anda (atau pemilik) boleh nampak dan sunting di Draf Saya." />
            <Kamus istilah="Menunggu" maksud="Sudah dihantar, belum jadi kandungan Aktif — sama ada tunggu semakan manusia atau tunggu slot kosong (lihat seksyen 07)." />
            <Kamus istilah="Aktif" maksud="Kandungan yang sedang tersiar di muka depan." />
            <Kamus istilah="Arkib" maksud="Kandungan yang pernah Aktif tapi sudah ditarik/luput — masih ada rekod, tidak dipaparkan." />
            <Kamus istilah="Ditolak" maksud="Keputusan penyemak menolak kandungan Menunggu — ia pulang jadi draf boleh sunting, bukan dipadam." />
            <Kamus istilah="Bajet Ruang" maksud="Had aksara kongsi tajuk+huraian ikut saiz fizikal kad tu (tier)." />
            <Kamus istilah="Dasar Terbit Sendiri Editor" maksud="Suis (Tetapan → Tetapan Am Slot) yang tentukan sama ada Editor boleh luluskan kandungan sendiri tanpa Ketua Editor/Penolong." />
            <Kamus istilah="Terbit Semua" maksud="Hantar semua draf yang lulus bajet ruang dalam satu slot sekaligus." />
          </dl>
        </PanelCard>
      </div>
    </div>
  );
};

export default PanduanConsole;
