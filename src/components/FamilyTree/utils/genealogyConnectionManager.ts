import { FamilyMember } from '../../../types/family';

export interface ConnectionPoint {
  x: number;
  y: number;
  type: 'parent' | 'child' | 'spouse' | 'sibling';
  memberId: string;
}

export interface GenealogyConnection {
  id: string;
  type: 'marriage' | 'parentChild' | 'sibling';
  sourceId: string;
  targetId: string;
  path: string;
  style: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    fill: string;
  };
}

export interface BracketConnection {
  id: string;
  type: 'marriageBracket' | 'parentChildBracket' | 'siblingBracket';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
  members: string[];
}

/**
 * Manages genealogy connections with proper bracket-style lines
 * Follows standard genealogy chart conventions
 */
export class GenealogyConnectionManager {
  private memberPositions: Map<string, { x: number; y: number }> = new Map();
  private connections: GenealogyConnection[] = [];
  private brackets: BracketConnection[] = [];

  constructor(members: FamilyMember[], positions: Record<string, { x: number; y: number }>) {
    this.updateMemberPositions(positions);
    this.generateConnections(members);
  }

  private updateMemberPositions(positions: Record<string, { x: number; y: number }>) {
    this.memberPositions.clear();
    Object.entries(positions).forEach(([id, position]) => {
      this.memberPositions.set(id, position);
    });
  }

  private generateConnections(members: FamilyMember[]) {
    this.connections = [];
    this.brackets = [];

    // Generate marriage connections with brackets
    this.generateMarriageConnections(members);
    
    // Generate parent-child connections with proper brackets
    this.generateParentChildConnections(members);
    
    // Generate sibling connections
    this.generateSiblingConnections(members);
  }

  private generateMarriageConnections(members: FamilyMember[]) {
    const processedPairs = new Set<string>();

    members.forEach(member => {
      if (member.spouseId && !processedPairs.has(`${member.id}-${member.spouseId}`)) {
        const spouse = members.find(m => m.id === member.spouseId);
        if (!spouse) return;

        const memberPos = this.memberPositions.get(member.id);
        const spousePos = this.memberPositions.get(spouse.id);
        
        if (!memberPos || !spousePos) return;

        // Determine left and right positions
        const leftMember = memberPos.x < spousePos.x ? member : spouse;
        const rightMember = memberPos.x < spousePos.x ? spouse : member;
        const leftPos = memberPos.x < spousePos.x ? memberPos : spousePos;
        const rightPos = memberPos.x < spousePos.x ? spousePos : memberPos;

        // Create marriage bracket connection
        const bracketY = Math.min(leftPos.y, rightPos.y) + 100; // Below both members
        const centerX = (leftPos.x + rightPos.x) / 2;

        // Marriage line: horizontal line connecting the two
        this.connections.push({
          id: `marriage-${leftMember.id}-${rightMember.id}`,
          type: 'marriage',
          sourceId: leftMember.id,
          targetId: rightMember.id,
          path: this.createHorizontalLine(leftPos.x, rightPos.x, bracketY),
          style: {
            stroke: '#dc2626', // Red for marriage
            strokeWidth: 3,
            fill: 'none'
          }
        });

        // Vertical connectors from members to marriage line
        this.connections.push({
          id: `marriage-connector-${leftMember.id}`,
          type: 'marriage',
          sourceId: leftMember.id,
          targetId: rightMember.id,
          path: this.createVerticalLine(leftPos.x, leftPos.y + 100, bracketY),
          style: {
            stroke: '#dc2626',
            strokeWidth: 2,
            fill: 'none'
          }
        });

        this.connections.push({
          id: `marriage-connector-${rightMember.id}`,
          type: 'marriage',
          sourceId: rightMember.id,
          targetId: leftMember.id,
          path: this.createVerticalLine(rightPos.x, rightPos.y + 100, bracketY),
          style: {
            stroke: '#dc2626',
            strokeWidth: 2,
            fill: 'none'
          }
        });

        // Create bracket for marriage
        this.brackets.push({
          id: `marriage-bracket-${leftMember.id}-${rightMember.id}`,
          type: 'marriageBracket',
          x1: leftPos.x,
          y1: bracketY,
          x2: rightPos.x,
          y2: bracketY,
          centerX,
          centerY: bracketY,
          members: [leftMember.id, rightMember.id]
        });

        processedPairs.add(`${member.id}-${member.spouseId}`);
        processedPairs.add(`${member.spouseId}-${member.id}`);
      }
    });
  }

  private generateParentChildConnections(members: FamilyMember[]) {
    // Group children by their parents
    const parentChildGroups = new Map<string, FamilyMember[]>();
    
    members.forEach(member => {
      if (member.parentIds && member.parentIds.length > 0) {
        const parentKey = [...member.parentIds].sort().join('-');
        if (!parentChildGroups.has(parentKey)) {
          parentChildGroups.set(parentKey, []);
        }
        parentChildGroups.get(parentKey)!.push(member);
      }
    });

    parentChildGroups.forEach((children, parentKey) => {
      const parentIds = parentKey.split('-');
      const parents = parentIds.map(id => members.find(m => m.id === id)).filter(Boolean) as FamilyMember[];
      
      if (parents.length === 0 || children.length === 0) return;

      // Get parent positions
      const parentPositions = parents.map(parent => this.memberPositions.get(parent.id)).filter(Boolean);
      if (parentPositions.length === 0) return;

      // Calculate parent center point (for marriages, use marriage line center)
      let parentCenterX: number;
      let parentCenterY: number;

      if (parents.length === 2) {
        // Find marriage bracket for these parents
        const marriageBracket = this.brackets.find(b => 
          b.type === 'marriageBracket' && 
          b.members.includes(parents[0].id) && 
          b.members.includes(parents[1].id)
        );
        
        if (marriageBracket) {
          parentCenterX = marriageBracket.centerX;
          parentCenterY = marriageBracket.centerY;
        } else {
          parentCenterX = (parentPositions[0].x + parentPositions[1].x) / 2;
          parentCenterY = Math.max(parentPositions[0].y, parentPositions[1].y) + 100;
        }
      } else {
        parentCenterX = parentPositions[0].x;
        parentCenterY = parentPositions[0].y + 100;
      }

      // Sort children by x position
      const sortedChildren = children.sort((a, b) => {
        const posA = this.memberPositions.get(a.id);
        const posB = this.memberPositions.get(b.id);
        return (posA?.x || 0) - (posB?.x || 0);
      });

      const childPositions = sortedChildren.map(child => this.memberPositions.get(child.id)).filter(Boolean);
      if (childPositions.length === 0) return;

      // Calculate children line Y position
      const childrenY = Math.min(...childPositions.map(pos => pos.y)) - 50;

      // Create main vertical line from parent center down
      const mainLineEndY = childrenY + 25;
      this.connections.push({
        id: `parent-main-${parentKey}`,
        type: 'parentChild',
        sourceId: parents[0].id,
        targetId: sortedChildren[0].id,
        path: this.createVerticalLine(parentCenterX, parentCenterY, mainLineEndY),
        style: {
          stroke: '#374151',
          strokeWidth: 2,
          fill: 'none'
        }
      });

      // Create horizontal line connecting all children
      if (childPositions.length > 1) {
        const leftmostX = Math.min(...childPositions.map(pos => pos.x));
        const rightmostX = Math.max(...childPositions.map(pos => pos.x));
        
        this.connections.push({
          id: `children-line-${parentKey}`,
          type: 'parentChild',
          sourceId: parents[0].id,
          targetId: sortedChildren[0].id,
          path: this.createHorizontalLine(leftmostX, rightmostX, mainLineEndY),
          style: {
            stroke: '#374151',
            strokeWidth: 2,
            fill: 'none'
          }
        });
      }

      // Create vertical lines to each child
      sortedChildren.forEach(child => {
        const childPos = this.memberPositions.get(child.id);
        if (!childPos) return;

        this.connections.push({
          id: `child-connector-${child.id}`,
          type: 'parentChild',
          sourceId: parents[0].id,
          targetId: child.id,
          path: this.createVerticalLine(childPos.x, mainLineEndY, childPos.y - 100),
          style: {
            stroke: '#374151',
            strokeWidth: 2,
            fill: 'none'
          }
        });
      });

      // Create parent-child bracket
      this.brackets.push({
        id: `parent-child-bracket-${parentKey}`,
        type: 'parentChildBracket',
        x1: parentCenterX,
        y1: parentCenterY,
        x2: parentCenterX,
        y2: mainLineEndY,
        centerX: parentCenterX,
        centerY: (parentCenterY + mainLineEndY) / 2,
        members: [...parentIds, ...sortedChildren.map(c => c.id)]
      });
    });
  }

  private generateSiblingConnections(members: FamilyMember[]) {
    // Group siblings by their parents
    const siblingGroups = new Map<string, FamilyMember[]>();
    
    members.forEach(member => {
      if (member.parentIds && member.parentIds.length > 0) {
        const parentKey = [...member.parentIds].sort().join('-');
        if (!siblingGroups.has(parentKey)) {
          siblingGroups.set(parentKey, []);
        }
        siblingGroups.get(parentKey)!.push(member);
      }
    });

    siblingGroups.forEach((siblings, parentKey) => {
      if (siblings.length < 2) return; // Need at least 2 siblings

      const siblingPositions = siblings
        .map(sibling => ({
          member: sibling,
          position: this.memberPositions.get(sibling.id)
        }))
        .filter(item => item.position);

      if (siblingPositions.length < 2) return;

      // Sort siblings by x position
      siblingPositions.sort((a, b) => a.position!.x - b.position!.x);

      // Create sibling bracket (already handled in parent-child connections)
      const leftmost = siblingPositions[0];
      const rightmost = siblingPositions[siblingPositions.length - 1];
      
      this.brackets.push({
        id: `sibling-bracket-${parentKey}`,
        type: 'siblingBracket',
        x1: leftmost.position!.x,
        y1: leftmost.position!.y - 50,
        x2: rightmost.position!.x,
        y2: rightmost.position!.y - 50,
        centerX: (leftmost.position!.x + rightmost.position!.x) / 2,
        centerY: leftmost.position!.y - 50,
        members: siblings.map(s => s.id)
      });
    });
  }

  private createHorizontalLine(x1: number, x2: number, y: number): string {
    return `M ${x1} ${y} L ${x2} ${y}`;
  }

  private createVerticalLine(x: number, y1: number, y2: number): string {
    return `M ${x} ${y1} L ${x} ${y2}`;
  }

  public getConnections(): GenealogyConnection[] {
    return this.connections;
  }

  public getBrackets(): BracketConnection[] {
    return this.brackets;
  }

  public updatePositions(positions: Record<string, { x: number; y: number }>, members: FamilyMember[]) {
    this.updateMemberPositions(positions);
    this.generateConnections(members);
  }
}
