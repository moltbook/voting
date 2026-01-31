/**
 * In-memory adapter for testing and development
 */

/**
 * Create an in-memory storage adapter
 * 
 * @returns {Object} Adapter with all required methods
 */
function createMemoryAdapter() {
  const votes = new Map();
  const karma = new Map();

  /**
   * Generate storage key for votes
   */
  function voteKey(agentId, targetId, targetType) {
    return `${agentId}:${targetId}:${targetType}`;
  }

  return {
    /**
     * Get a vote
     */
    async getVote(agentId, targetId, targetType) {
      const key = voteKey(agentId, targetId, targetType);
      const vote = votes.get(key);
      return vote || null;
    },

    /**
     * Save a vote
     */
    async saveVote(vote) {
      const key = voteKey(vote.agentId, vote.targetId, vote.targetType);
      votes.set(key, {
        value: vote.value,
        createdAt: vote.createdAt || new Date()
      });
    },

    /**
     * Delete a vote
     */
    async deleteVote(agentId, targetId, targetType) {
      const key = voteKey(agentId, targetId, targetType);
      votes.delete(key);
    },

    /**
     * Update agent karma
     */
    async updateKarma(agentId, delta) {
      const current = karma.get(agentId) || 0;
      karma.set(agentId, current + delta);
    },

    /**
     * Get agent karma (helper method for testing)
     */
    async getKarma(agentId) {
      return karma.get(agentId) || 0;
    },

    /**
     * Count votes on a target
     */
    async countVotes(targetId, targetType) {
      let upvotes = 0;
      let downvotes = 0;

      for (const [key, vote] of votes.entries()) {
        if (key.includes(`:${targetId}:${targetType}`)) {
          if (vote.value === 1) upvotes++;
          else if (vote.value === -1) downvotes++;
        }
      }

      return {
        upvotes,
        downvotes,
        score: upvotes - downvotes
      };
    },

    /**
     * Clear all data (for testing)
     */
    async clear() {
      votes.clear();
      karma.clear();
    },

    /**
     * Get raw data (for debugging)
     */
    _getData() {
      return {
        votes: Object.fromEntries(votes),
        karma: Object.fromEntries(karma)
      };
    }
  };
}

module.exports = { createMemoryAdapter };
