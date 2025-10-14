import React, { useMemo } from 'react';
import { FamilyMember } from '../../types/family';
import { GenealogyConnectionManager } from './utils/genealogyConnectionManager';

interface GenealogyConnectionsProps {
  members: FamilyMember[];
  memberPositions: Record<string, { x: number; y: number }>;
  canvasDimensions: { width: number; height: number };
}

export const GenealogyConnections: React.FC<GenealogyConnectionsProps> = ({
  members,
  memberPositions,
  canvasDimensions
}) => {
  const connectionManager = useMemo(() => {
    return new GenealogyConnectionManager(members, memberPositions);
  }, [members, memberPositions]);

  const connections = connectionManager.getConnections();
  const brackets = connectionManager.getBrackets();

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        zIndex: 5
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Marriage connection marker */}
        <marker
          id="marriage-marker"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
        >
          <circle cx="4" cy="4" r="2" fill="#dc2626" />
        </marker>

        {/* Parent-child arrow marker */}
        <marker
          id="parent-child-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#374151" />
        </marker>

        {/* Gradient for marriage lines */}
        <linearGradient id="marriage-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Render all connection lines */}
      <g className="genealogy-connections">
        {connections.map(connection => (
          <path
            key={connection.id}
            d={connection.path}
            style={connection.style}
            className={`connection-${connection.type}`}
            markerEnd={connection.type === 'parentChild' ? 'url(#parent-child-arrow)' : undefined}
          />
        ))}
      </g>

      {/* Render marriage symbols at bracket centers */}
      <g className="marriage-symbols">
        {brackets
          .filter(bracket => bracket.type === 'marriageBracket')
          .map(bracket => (
            <g key={`marriage-symbol-${bracket.id}`}>
              {/* Marriage rings symbol */}
              <circle
                cx={bracket.centerX - 6}
                cy={bracket.centerY}
                r="4"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
              />
              <circle
                cx={bracket.centerX + 6}
                cy={bracket.centerY}
                r="4"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
              />
              {/* Small connecting line between rings */}
              <path
                d={`M ${bracket.centerX - 2} ${bracket.centerY} L ${bracket.centerX + 2} ${bracket.centerY}`}
                stroke="#dc2626"
                strokeWidth="2"
              />
            </g>
          ))}
      </g>

      {/* Render generation indicators */}
      <g className="generation-indicators">
        {Array.from(new Set(members.map(m => m.generation))).map(generation => {
          const generationMembers = members.filter(m => m.generation === generation);
          const positions = generationMembers
            .map(m => memberPositions[m.id])
            .filter(Boolean);
          
          if (positions.length === 0) return null;
          
          const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
          const minX = Math.min(...positions.map(pos => pos.x));
          const maxX = Math.max(...positions.map(pos => pos.x));
          
          return (
            <g key={`generation-${generation}`}>
              {/* Generation background line */}
              <line
                x1={minX - 200}
                y1={avgY}
                x2={maxX + 200}
                y2={avgY}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="5,5"
                opacity="0.3"
              />
              {/* Generation label */}
              <text
                x={minX - 180}
                y={avgY + 5}
                fontSize="12"
                fill="#6b7280"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
              >
                Generasi {generation}
              </text>
            </g>
          );
        })}
      </g>

      {/* Debug mode: show bracket centers */}
      {process.env.NODE_ENV === 'development' && (
        <g className="debug-brackets">
          {brackets.map(bracket => (
            <circle
              key={`debug-${bracket.id}`}
              cx={bracket.centerX}
              cy={bracket.centerY}
              r="3"
              fill="orange"
              opacity="0.5"
            />
          ))}
        </g>
      )}
    </svg>
  );
};
