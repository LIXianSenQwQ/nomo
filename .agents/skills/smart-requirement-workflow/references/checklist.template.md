# Verification Checklist: {{FEATURE_NAME}}

> This checklist is used to verify that ALL features are implemented correctly before marking the requirement as completed. Every item must be objectively verifiable. It must be fully checked before closing the requirement.

## Functional Verification
- [ ] Core workflow runs end-to-end without errors
- [ ] All scenarios defined in `spec.md` produce the expected outcomes
- [ ] Edge cases from spec are handled properly (empty data, network failure, invalid input)

## Code Quality
- [ ] No new TypeScript type errors introduced
- [ ] No new linting warnings introduced
- [ ] No debug logs, commented-out code, or `console.log` left in the production path

## Testing
- [ ] Unit tests for new logic pass
- [ ] Manual smoke test on target platform passes
- [ ] No regressions in related existing functionality

## Non-Functional
- [ ] UI displays correctly across supported resolutions / viewports
- [ ] Performance is acceptable (no noticeable lag or jank)
- [ ] Error states show user-friendly messages (not raw stack traces)