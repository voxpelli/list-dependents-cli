# Resume Functionality Implementation Notes

## Current Implementation (CLI Level)

The resume functionality is implemented entirely at the CLI level in `list-dependents-cli`:

1. **Incremental Writing**: Data is written to a temporary file as each item is fetched
2. **Error Handling**: On error (including 500 errors), the temp file is saved as `<output>.partial`
3. **Resume Instructions**: User is shown how to resume: `list-dependents list -i <partial-file> -o <output> <module-name>`
4. **Deduplication**: When resuming, existing items are read and compared; unchanged items are skipped

### Supported Scenarios

✅ **File Output**: Resume is supported when using:
- `-o <filename>` (explicit output file)
- `-n <module-name>` (named file: `<module-name>.ndjson`)
- `<module-name> <filename>` (positional output file)

❌ **Stdout Output**: Resume is NOT supported when:
- Outputting to stdout (no `-o` or `-n` flag)
- Using pipes: `list-dependents list mocha | ...`

❌ **Check Mode**: Resume is NOT supported in:
- `--check` mode (read-only verification, no writes)

This is intentional as these scenarios don't involve persistent file output where partial data can be saved.

### How It Works

```bash
# Initial run (fails midway with 500 error)
$ list-dependents list -o mocha.ndjson mocha
# ... fetches 100 packages, then 500 error occurs
# Partial data saved to: mocha.ndjson.partial
# To resume, run: list-dependents list -i mocha.ndjson.partial -o mocha.ndjson mocha

# Resume from where it left off
$ list-dependents list -i mocha.ndjson.partial -o mocha.ndjson mocha
# Reads 100 already-fetched packages into memory
# Continues fetching from API (starts from page 1)
# Skips packages already in memory (marked as "unchanged")
# Fetches new packages (marked as "added")
# Removes packages that are no longer dependents
# Writes final complete list to mocha.ndjson
```

## Potential Improvements in `list-dependents` Library

While the current CLI-level implementation solves the core problem (not losing progress on errors), the underlying `list-dependents` library could be enhanced for better efficiency:

### 1. Skip Already-Fetched Packages

**Current Behavior**: When resuming, we re-fetch packages from page 1 onward, checking each against our in-memory list.

**Potential Improvement**: Add a `skipList` option to `fetchEcosystemDependents`:

```typescript
interface EcosystemDependentsOptions {
  // ... existing options
  skipList?: Set<string>; // Package names to skip during fetching
}
```

This would:
- Avoid re-downloading package metadata we already have
- Reduce API calls to ecosyste.ms
- Speed up resume process

**Implementation in list-dependents**:
```javascript
// In fetchEcosystemDependents generator
for await (const item of fetchJsonPages(...)) {
  const dependent = getObjectStringValue(item, 'name');
  
  if (!dependent || seen.has(dependent) || options.skipList?.has(dependent)) {
    continue; // Skip already-processed packages
  }
  // ... rest of processing
}
```

### 2. Pagination Checkpoint Support

**Current Behavior**: Always starts from page 1 of API results.

**Potential Improvement**: Add ability to start from a specific page:

```typescript
interface EcosystemDependentsOptions {
  // ... existing options
  startPage?: number; // Page number to start from (default: 1)
}
```

**Challenge**: This requires tracking which page we were on when error occurred. The CLI would need to:
- Track current page number as we process items
- Save page number in the partial file (as metadata)
- Pass `startPage` when resuming

This is more complex and may not be worth it because:
- We'd still need to skip packages from earlier pages that appear in results
- ecosyste.ms API pagination may not be stable (order could change between calls)

### 3. Progress Callback

**Potential Improvement**: Add a progress callback to report fetching status:

```typescript
interface EcosystemDependentsOptions {
  // ... existing options
  onProgress?: (progress: { page: number, total: number, current: string }) => void;
}
```

This would allow the CLI to:
- Save checkpoints more granularly
- Provide better progress updates
- Make smarter decisions about when to flush data to disk

## Recommendation

**For this issue**: The CLI-level implementation is sufficient and solves the problem with minimal changes.

**For future enhancement**: Consider adding `skipList` option to `list-dependents` in a future version. This would:
- Improve resume efficiency
- Reduce load on ecosyste.ms API
- Be backward compatible (optional parameter)

**Not recommended**: Pagination checkpoint support is complex and prone to race conditions due to API result ordering.

## Trade-offs

### Current CLI-only Approach
✅ Minimal changes to codebase  
✅ No changes needed to `list-dependents` library  
✅ Works with existing `list-dependents` versions  
✅ Solves the core problem: no more data loss on errors  
⚠️ Re-fetches some data when resuming (not a major issue)

### With `list-dependents` Changes
✅ More efficient resume (skips re-fetching)  
✅ Reduces API load  
⚠️ Requires coordinated release of both packages  
⚠️ More complex implementation  
⚠️ May not be worth the added complexity

## Testing Scenarios

1. **Normal operation**: Verify incremental writing works without errors
2. **Error mid-fetch**: Simulate 500 error, verify partial file is created
3. **Resume after error**: Use partial file as input, verify continuation
4. **Multiple resume attempts**: Error, resume, error again, resume again
5. **Stdout output**: Verify temp file is not created when outputting to stdout
6. **Check mode**: Verify temp file is not created in check mode

## Files Modified

- `lib/commands/list.js`: Main implementation with incremental writing and error handling
