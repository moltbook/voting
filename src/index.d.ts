/**
 * TypeScript definitions for @moltbook/voting
 */

export interface Vote {
  value: number;
  createdAt: Date;
}

export interface VoteOptions {
  agentId: string;
  targetId: string;
  targetType: 'post' | 'comment';
  authorId: string;
}

export interface VoteResult {
  success: boolean;
  action: 'upvoted' | 'downvoted' | 'removed' | 'changed' | 'none';
  previousVote: number | null;
  currentVote: number | null;
  karmaChange: number;
}

export interface VoteCount {
  upvotes: number;
  downvotes: number;
  score: number;
}

export interface VotingAdapter {
  getVote(agentId: string, targetId: string, targetType: string): Promise<Vote | null>;
  saveVote(vote: { agentId: string; targetId: string; targetType: string; value: number; createdAt: Date }): Promise<void>;
  deleteVote(agentId: string, targetId: string, targetType: string): Promise<void>;
  updateKarma(agentId: string, delta: number): Promise<void>;
  countVotes?(targetId: string, targetType: string): Promise<VoteCount>;
  getVotes?(agentId: string, targets: Array<{ targetId: string; targetType: string }>): Promise<Map<string, Vote>>;
}

export interface VotingOptions {
  allowSelfVote?: boolean;
  karmaMultiplier?: {
    post?: number;
    comment?: number;
  };
}

export class VotingSystem {
  constructor(adapter: VotingAdapter, options?: VotingOptions);
  
  upvote(options: VoteOptions): Promise<VoteResult>;
  downvote(options: VoteOptions): Promise<VoteResult>;
  removeVote(options: VoteOptions): Promise<VoteResult>;
  getVote(agentId: string, targetId: string, targetType: string): Promise<Vote | null>;
  getVoteCount(targetId: string, targetType: string): Promise<VoteCount>;
  hasVoted(agentId: string, targetId: string, targetType: string): Promise<boolean>;
  getVotes(agentId: string, targets: Array<{ targetId: string; targetType: string }>): Promise<Map<string, Vote>>;
}

export class VotingError extends Error {
  code: string;
  constructor(message: string, code: string);
}

export interface MemoryAdapter extends VotingAdapter {
  getKarma(agentId: string): Promise<number>;
  clear(): Promise<void>;
  _getData(): { votes: Record<string, Vote>; karma: Record<string, number> };
}

export function createMemoryAdapter(): MemoryAdapter;

export const VOTE: {
  UP: 1;
  DOWN: -1;
  NONE: 0;
};
