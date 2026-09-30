import { PartialType } from '@nestjs/mapped-types';
import { CreateRuleDto } from './create-rule.dto';

// A real class (not a TypeScript `Partial<>` type) so the global ValidationPipe
// validates every field and whitelists away anything else, e.g. organizationId.
export class UpdateRuleDto extends PartialType(CreateRuleDto) {}
