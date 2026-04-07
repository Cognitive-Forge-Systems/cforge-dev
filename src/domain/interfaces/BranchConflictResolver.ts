import { BranchConflictAction } from "../models/BranchConflictAction";

export interface BranchConflictResolver {
  resolve(branch: string): Promise<BranchConflictAction>;
}
