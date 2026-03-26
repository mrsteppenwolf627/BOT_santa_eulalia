import type { StateMachineInput, StateMachineOutput } from '../types';

/**
 * The bot is silent while waiting for a human agent (via Chatwoot).
 * No automated reply is sent. The state only changes when Chatwoot signals it.
 */
export function handleAwaitingHuman(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'awaiting_human',
    messages: [],
    action: null,
    requiresEntityExtraction: false,
  };
}
