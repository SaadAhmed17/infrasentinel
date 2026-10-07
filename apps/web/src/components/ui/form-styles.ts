// One look for every form control in the app. Native <input>/<select> elements
// use these classes so forms stay consistent across pages and themes.
export const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-medium text-muted-foreground';

export const fieldControlClass =
  'h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-muted-foreground/70 hover:border-foreground/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive pointer-coarse:h-11 pointer-coarse:text-[15px]';

export const fieldSelectClass = `${fieldControlClass} select-chevron cursor-pointer`;

export const fieldHintClass = 'mt-1.5 text-[12.5px] text-muted-foreground';

export const fieldErrorClass =
  'flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-[13.5px] font-medium text-destructive';

/** Error under a single field. */
export const fieldInlineErrorClass = 'mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-destructive';
