import React from 'react';
import { HeroCard } from './HeroCard';
import { MenegakCard } from './MenegakCard';
import { KompakCard } from './KompakCard';
import { BarCard } from './BarCard';
import { tierForSlot } from '../../../../core/editorial/GeometryConfig.js';

interface BentoCardRendererProps {
  slotIndex: number;
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export const BentoCardRenderer: React.FC<BentoCardRendererProps> = ({
  slotIndex,
  item,
  onClick,
  isEditMode,
  onEditClick,
}) => {
  if (!item) return null;

  const tier = tierForSlot(slotIndex);

  switch (tier) {
    case 'HERO':
      return <HeroCard item={item} onClick={onClick} isEditMode={isEditMode} onEditClick={onEditClick} />;
    case 'MENEGAK':
      return <MenegakCard item={item} onClick={onClick} isEditMode={isEditMode} onEditClick={onEditClick} />;
    case 'KOMPAK':
      return <KompakCard item={item} onClick={onClick} isEditMode={isEditMode} onEditClick={onEditClick} />;
    case 'BAR':
      return <BarCard item={item} onClick={onClick} isEditMode={isEditMode} onEditClick={onEditClick} />;
    default:
      return <MenegakCard item={item} onClick={onClick} isEditMode={isEditMode} onEditClick={onEditClick} />;
  }
};
