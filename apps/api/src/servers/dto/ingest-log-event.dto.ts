import { IsIn, IsString } from 'class-validator';

// The only event types an agent may report. Anything else (e.g.
// AUTH_LOGIN_SUCCESS) would let a stolen agent key forge platform events.
export const AGENT_EVENT_TYPES = ['SSH_LOGIN_FAILURE', 'SSH_LOGIN_SUCCESS'];

export class IngestLogEventDto {
  @IsIn(AGENT_EVENT_TYPES)
  eventType!: string;

  @IsIn(['SUCCESS', 'FAILURE'])
  outcome!: 'SUCCESS' | 'FAILURE';

  @IsString()
  username!: string;

  @IsString()
  ipAddress!: string;
}
