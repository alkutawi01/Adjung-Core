import React from 'react';
import {
  Star, Flag, Globe2, TrendingUp, Briefcase, Cpu, FlaskConical, Stethoscope, GraduationCap, Scale, MoonStar, BookMarked, Lightbulb, Brain,
  Languages, Feather, ScrollText, Map, Leaf, Rocket, Palette, Drama, Trophy, Sigma, Tag,
  Landmark, Building2, Heart, Music, Film, Mic, Video, PenTool, Plane, Car, Compass, TreePine, Users, Shield, Coins,
  type LucideIcon
} from 'lucide-react';

// Peta nama ikon (lucide-react, kes Pascal, cth "TrendingUp") tersimpan di CategoryRegistry.icon
// -> komponen sebenar. SATU sumber tunggal: diimport oleh pemilih ikon di Taksonomi
// (TetapanConsole) DAN oleh Focus View di frontpage. Jangan salin peta ni ke tempat lain —
// dua salinan bermakna satu skrin boleh papar ikon berbeza daripada skrin lain untuk Bidang sama.
export const BIDANG_ICON_MAP: Record<string, LucideIcon> = {
  Star, Flag, Globe2, TrendingUp, Briefcase, Cpu, FlaskConical, Stethoscope, GraduationCap, Scale, MoonStar, BookMarked, Lightbulb, Brain,
  Languages, Feather, ScrollText, Map, Leaf, Rocket, Palette, Drama, Trophy, Sigma,
  Landmark, Building2, Heart, Music, Film, Mic, Video, PenTool, Plane, Car, Compass, TreePine, Users, Shield, Coins
};

export const BIDANG_ICON_NAMES = Object.keys(BIDANG_ICON_MAP).sort();

interface BidangIconProps {
  iconName: string | null;
  /** Markup SVG custom (dah disanitize server-side) — menang atas iconName bila dua-dua ada. */
  iconSvg?: string | null;
  color: string;
  /** Lencana bulat berlatar (Taksonomi) atau glif kosong tanpa latar (Focus View). */
  variant?: 'badge' | 'bare';
  /** Saiz glif dalam px. Lencana sentiasa 28px; ni saiz ikon di dalamnya. */
  size?: number;
}

export const BidangIcon: React.FC<BidangIconProps> = ({ iconName, iconSvg, color, variant = 'badge', size = 14 }) => {
  const isBadge = variant === 'badge';
  const wrapperClass = isBadge
    ? 'inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0'
    : 'inline-flex items-center justify-center shrink-0';
  const wrapperStyle: React.CSSProperties = isBadge
    ? { backgroundColor: `${color}1A`, color }
    : { color };

  if (iconSvg) {
    return (
      <span
        className={`${wrapperClass} bidang-icon-svg`}
        style={{ ...wrapperStyle, ['--bidang-icon-size' as any]: `${size}px` }}
        title="Ikon custom (SVG dimuat naik)"
        // eslint-disable-next-line react/no-danger -- markup ditapis ketat di server
        // (sanitizeSvgIcon di core/routes/categoryRoutes.js) sebelum sampai ke DB.
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />
    );
  }

  const IconComponent = (iconName && BIDANG_ICON_MAP[iconName]) || Tag;
  return (
    <span className={wrapperClass} style={wrapperStyle} title={iconName || 'Tiada ikon lagi'}>
      <IconComponent style={{ width: size, height: size }} />
    </span>
  );
};
