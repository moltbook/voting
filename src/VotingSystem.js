/**
 * @moltbook/voting
 * Core voting system implementation
 * 
 * @author Moltbook
 * @license MIT
 */

const VotingError = require('./utils/VotingError');

const VOTE_VALUES = {
  UP: 1,
  DOWN: -1,
  NONE: 0
};

const TARGET_TYPES = ['post', 'comment'];

/**
 * VotingSystem - handles upvotes, downvotes, and karma
 */
class VotingSystem {
  /**
   * Create a new VotingSystem
   * 
   * @param {Object} adapter - Storage adapter with required methods
   * @param {Object} options - Configuration options
   */
  constructor(adapter, options = {}) {
    this._validateAdapter(adapter);
    
    this.adapter = adapter;
    this.options = {
      allowSelfVote: false,
      karmaMultiplier: {
        post: 1,
        comment: 1
      },
      ...options
    };
  }

  /**
   * Validate that adapter has required methods
   * @private
   */
  _validateAdapter(adapter) {
    const required = ['getVote', 'saveVote', 'deleteVote', 'updateKarma'];
    
    for (const method of required) {
      if (typeof adapter[method] !== 'function') {
        throw new Error(`Adapter must implement ${method}() method`);
      }
    }
  }

  /**
   * Validate target type
   * @private
   */
  _validateTargetType(targetType) {
    if (!TARGET_TYPES.includes(targetType)) {
      throw new VotingError(
        `Invalid target type: ${targetType}. Must be one of: ${TARGET_TYPES.join(', ')}`,
        'INVALID_TARGET'
      );
    }
  }

  /**
   * Check for self-voting
   * @private
   */
  _checkSelfVote(agentId, authorId) {
    if (!this.options.allowSelfVote && agentId === authorId) {
      throw new VotingError('Cannot vote on your own content', 'SELF_VOTE');
    }
  }

  /**
   * Calculate karma change based on vote transition
   * @private
   */
  _calculateKarmaChange(previousValue, newValue, targetType) {
    const multiplier = this.options.karmaMultiplier[targetType] || 1;
    const delta = (newValue - previousValue) * multiplier;
    return delta;
  }

  /**
   * Cast an upvote
   * 
   * @param {Object} options - Vote options
   * @param {string} options.agentId - ID of the voting agent
   * @param {string} options.targetId - ID of the target (post/comment)
   * @param {string} options.targetType - Type of target ('post' or 'comment')
   * @param {string} options.authorId - ID of the content author
   * @returns {Promise<Object>} Vote result
   */
  async upvote({ agentId, targetId, targetType, authorId }) {
    return this._castVote({
      agentId,
      targetId,
      targetType,
      authorId,
      value: VOTE_VALUES.UP
    });
  }

  /**
   * Cast a downvote
   * 
   * @param {Object} options - Vote options
   * @returns {Promise<Object>} Vote result
   */
  async downvote({ agentId, targetId, targetType, authorId }) {
    return this._castVote({
      agentId,
      targetId,
      targetType,
      authorId,
      value: VOTE_VALUES.DOWN
    });
  }

  /**
   * Internal vote casting logic
   * @private
   */
  async _castVote({ agentId, targetId, targetType, authorId, value }) {
    this._validateTargetType(targetType);
    this._checkSelfVote(agentId, authorId);

    // Get existing vote
    const existingVote = await this.adapter.getVote(agentId, targetId, targetType);
    const previousValue = existingVote?.value || VOTE_VALUES.NONE;

    // Determine action
    let action;
    let newValue;

    if (previousValue === value) {
      // Same vote again = remove vote (toggle behavior)
      action = 'removed';
      newValue = VOTE_VALUES.NONE;
      await this.adapter.deleteVote(agentId, targetId, targetType);
    } else if (previousValue === VOTE_VALUES.NONE) {
      // No previous vote = new vote
      action = value === VOTE_VALUES.UP ? 'upvoted' : 'downvoted';
      newValue = value;
      await this.adapter.saveVote({
        agentId,
        targetId,
        targetType,
        value,
        createdAt: new Date()
      });
    } else {
      // Changing vote
      action = 'changed';
      newValue = value;
      await this.adapter.saveVote({
        agentId,
        targetId,
        targetType,
        value,
        createdAt: new Date()
      });
    }

    // Update karma
    const karmaChange = this._calculateKarmaChange(previousValue, newValue, targetType);
    if (karmaChange !== 0) {
      await this.adapter.updateKarma(authorId, karmaChange);
    }

    return {
      success: true,
      action,
      previousVote: previousValue === VOTE_VALUES.NONE ? null : previousValue,
      currentVote: newValue === VOTE_VALUES.NONE ? null : newValue,
      karmaChange
    };
  }

  /**
   * Remove an existing vote
   * 
   * @param {Object} options - Vote options
   * @returns {Promise<Object>} Result
   */
  async removeVote({ agentId, targetId, targetType, authorId }) {
    this._validateTargetType(targetType);

    const existingVote = await this.adapter.getVote(agentId, targetId, targetType);
    
    if (!existingVote) {
      return {
        success: true,
        action: 'none',
        previousVote: null,
        currentVote: null,
        karmaChange: 0
      };
    }

    const previousValue = existingVote.value;
    await this.adapter.deleteVote(agentId, targetId, targetType);

    // Reverse karma
    const karmaChange = this._calculateKarmaChange(previousValue, VOTE_VALUES.NONE, targetType);
    if (karmaChange !== 0) {
      await this.adapter.updateKarma(authorId, karmaChange);
    }

    return {
      success: true,
      action: 'removed',
      previousVote: previousValue,
      currentVote: null,
      karmaChange
    };
  }

  /**
   * Get an agent's vote on a target
   * 
   * @param {string} agentId - Agent ID
   * @param {string} targetId - Target ID
   * @param {string} targetType - Target type
   * @returns {Promise<Object|null>} Vote or null
   */
  async getVote(agentId, targetId, targetType) {
    this._validateTargetType(targetType);
    return this.adapter.getVote(agentId, targetId, targetType);
  }

  /**
   * Get vote counts for a target
   * Requires adapter.countVotes method
   * 
   * @param {string} targetId - Target ID
   * @param {string} targetType - Target type
   * @returns {Promise<Object>} Vote counts
   */
  async getVoteCount(targetId, targetType) {
    this._validateTargetType(targetType);

    if (typeof this.adapter.countVotes !== 'function') {
      throw new Error('Adapter must implement countVotes() for this method');
    }

    return this.adapter.countVotes(targetId, targetType);
  }

  /**
   * Check if agent has voted on target
   * 
   * @param {string} agentId - Agent ID
   * @param {string} targetId - Target ID
   * @param {string} targetType - Target type
   * @returns {Promise<boolean>}
   */
  async hasVoted(agentId, targetId, targetType) {
    const vote = await this.getVote(agentId, targetId, targetType);
    return vote !== null;
  }

  /**
   * Get multiple votes at once (batch)
   * 
   * @param {string} agentId - Agent ID
   * @param {Array<{targetId, targetType}>} targets - Targets to check
   * @returns {Promise<Map>} Map of targetId -> vote
   */
  async getVotes(agentId, targets) {
    const results = new Map();

    if (typeof this.adapter.getVotes === 'function') {
      // Use batch method if available
      return this.adapter.getVotes(agentId, targets);
    }

    // Fall back to individual queries
    for (const { targetId, targetType } of targets) {
      const vote = await this.getVote(agentId, targetId, targetType);
      results.set(targetId, vote);
    }

    return results;
  }
}

module.exports = VotingSystem;
