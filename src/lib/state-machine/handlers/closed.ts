import type { StateMachineInput, StateMachineOutput } from '../types';

/**
 * Session is closed. The bot does not respond.
 * A new message from the client will trigger a fresh conversation via getOrCreateConversation.
 */
export function handleClosed(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'closed',
    messages: [],
    action: null,
    requiresEntityExtraction: false,
  };
}
