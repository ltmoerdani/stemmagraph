import type { KinshipGraph } from './kinship'

export type KinshipKind =
  | 'self'
  | 'partner'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'parent-sibling'
  | 'sibling-child'
  | 'cousin'
  | 'ancestor'
  | 'descendant'
  | 'unrelated'

export interface RelationshipResult {
  kind: KinshipKind
  depth?: number
}

export interface RelatedPerson {
  personId: string
  kind: KinshipKind
  depth: number
}
