
// Helper to parse description safely
function tryParseDescription(desc: string): any {
  try {
    if (desc && desc.startsWith('{')) {
      return JSON.parse(desc);
    }
  } catch (e) {
    return null;
  }
  return null;
}
