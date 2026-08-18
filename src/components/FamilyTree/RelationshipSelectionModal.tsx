import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Heart, Baby, UserPlus } from 'lucide-react';

interface RelationshipSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: 'up' | 'down' | 'left' | 'right';
  onSelect: (relationship: string) => void;
}

export const RelationshipSelectionModal: React.FC<RelationshipSelectionModalProps> = ({
  isOpen,
  onClose,
  direction,
  onSelect
}) => {
  const { t } = useTranslation('canvas');
  const [selectedRelationship, setSelectedRelationship] = useState('');

  if (!isOpen) return null;

  const getRelationshipOptions = () => {
    switch (direction) {
      case 'left':
      case 'right':
        return [
          { 
            value: 'husband', 
            label: t('relationship.options.husband.label'), 
            icon: <Users className="w-5 h-5" />,
            description: t('relationship.options.husband.description'),
            color: 'blue'
          },
          { 
            value: 'wife', 
            label: t('relationship.options.wife.label'), 
            icon: <Heart className="w-5 h-5" />,
            description: t('relationship.options.wife.description'),
            color: 'pink'
          },
          { 
            value: 'partner', 
            label: t('relationship.options.partner.label'), 
            icon: <Users className="w-5 h-5" />,
            description: t('relationship.options.partner.description'),
            color: 'purple'
          }
        ];
      case 'up':
        return [
          { 
            value: 'father', 
            label: t('relationship.options.father.label'), 
            icon: <UserPlus className="w-5 h-5" />,
            description: t('relationship.options.father.description'),
            color: 'blue'
          },
          { 
            value: 'mother', 
            label: t('relationship.options.mother.label'), 
            icon: <UserPlus className="w-5 h-5" />,
            description: t('relationship.options.mother.description'),
            color: 'pink'
          },
          { 
            value: 'both_parents', 
            label: t('relationship.options.both_parents.label'), 
            icon: <Users className="w-5 h-5" />,
            description: t('relationship.options.both_parents.description'),
            color: 'green'
          },
          { 
            value: 'grandfather', 
            label: t('relationship.options.grandfather.label'), 
            icon: <UserPlus className="w-5 h-5" />,
            description: t('relationship.options.grandfather.description'),
            color: 'gray'
          },
          { 
            value: 'grandmother', 
            label: t('relationship.options.grandmother.label'), 
            icon: <UserPlus className="w-5 h-5" />,
            description: t('relationship.options.grandmother.description'),
            color: 'gray'
          }
        ];
      case 'down':
        return [
          { 
            value: 'biological_child', 
            label: t('relationship.options.biological_child.label'), 
            icon: <Baby className="w-5 h-5" />,
            description: t('relationship.options.biological_child.description'),
            color: 'green'
          },
          { 
            value: 'step_child', 
            label: t('relationship.options.step_child.label'), 
            icon: <UserPlus className="w-5 h-5" />,
            description: t('relationship.options.step_child.description'),
            color: 'orange'
          },
          { 
            value: 'adopted_child', 
            label: t('relationship.options.adopted_child.label'), 
            icon: <Heart className="w-5 h-5" />,
            description: t('relationship.options.adopted_child.description'),
            color: 'purple'
          },
          { 
            value: 'grandchild', 
            label: t('relationship.options.grandchild.label'), 
            icon: <Baby className="w-5 h-5" />,
            description: t('relationship.options.grandchild.description'),
            color: 'yellow'
          },
          { 
            value: 'great_grandchild', 
            label: t('relationship.options.great_grandchild.label'), 
            icon: <Baby className="w-5 h-5" />,
            description: t('relationship.options.great_grandchild.description'),
            color: 'indigo'
          }
        ];
      default:
        return [];
    }
  };

  const getDirectionIcon = () => {
    switch (direction) {
      case 'up':
        return <ArrowUp className="w-5 h-5" />;
      case 'down':
        return <ArrowDown className="w-5 h-5" />;
      case 'left':
        return <ArrowLeft className="w-5 h-5" />;
      case 'right':
        return <ArrowRight className="w-5 h-5" />;
    }
  };

  const getDirectionTitle = () => {
    switch (direction) {
      case 'up':
        return t('relationship.titles.ancestor');
      case 'down':
        return t('relationship.titles.descendant');
      case 'left':
        return t('relationship.titles.partnerLeft');
      case 'right':
        return t('relationship.titles.partnerRight');
    }
  };

  const getDirectionDescription = () => {
    return t(`relationship.position.${direction}`);
  };

  const handleContinue = () => {
    if (selectedRelationship) {
      onSelect(selectedRelationship);
    }
  };

  const relationshipOptions = getRelationshipOptions();

  const getColorClasses = (color: string, isSelected: boolean) => {
    const baseClasses = 'border-2 rounded-lg transition-all duration-200';
    
    if (isSelected) {
      switch (color) {
        case 'blue': return `${baseClasses} border-blue-500 bg-blue-50`;
        case 'pink': return `${baseClasses} border-pink-500 bg-pink-50`;
        case 'green': return `${baseClasses} border-green-500 bg-green-50`;
        case 'purple': return `${baseClasses} border-purple-500 bg-purple-50`;
        case 'orange': return `${baseClasses} border-orange-500 bg-orange-50`;
        case 'yellow': return `${baseClasses} border-yellow-500 bg-yellow-50`;
        case 'indigo': return `${baseClasses} border-indigo-500 bg-indigo-50`;
        case 'gray': return `${baseClasses} border-gray-500 bg-gray-50`;
        default: return `${baseClasses} border-blue-500 bg-blue-50`;
      }
    }
    
    return `${baseClasses} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
  };

  const getIconColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'text-blue-600';
      case 'pink': return 'text-pink-600';
      case 'green': return 'text-green-600';
      case 'purple': return 'text-purple-600';
      case 'orange': return 'text-orange-600';
      case 'yellow': return 'text-yellow-600';
      case 'indigo': return 'text-indigo-600';
      case 'gray': return 'text-gray-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              {getDirectionIcon()}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{getDirectionTitle()}</h3>
              <p className="text-sm text-gray-600">{getDirectionDescription()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label={t('relationship.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 mb-2">{t('relationship.selectType')}</h4>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {relationshipOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-start p-4 cursor-pointer ${getColorClasses(option.color, selectedRelationship === option.value)}`}
              >
                <input
                  type="radio"
                  name="relationship"
                  value={option.value}
                  checked={selectedRelationship === option.value}
                  onChange={(e) => setSelectedRelationship(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-start space-x-3 w-full">
                  <div className={`p-2 rounded-lg bg-white shadow-xs ${getIconColorClasses(option.color)}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {option.description}
                    </div>
                  </div>
                  {selectedRelationship === option.value && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
          >
            {t('relationship.cancel')}
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedRelationship}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
          >
            <span>{t('relationship.continue')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
