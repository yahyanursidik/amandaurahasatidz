import { registrationInstitutionSearchKey, type RegistrationInstitutionSuggestion } from "../../../../src/lib/registrationInstitution";

const byLabel = new Intl.Collator("id-ID", { sensitivity: "base", numeric: true });

function containsWord(words: string[], term: string) {
  return words.some((word) => term.length < 3 ? word.startsWith(term) : word.includes(term));
}

function hasSmallTypo(term: string, word: string) {
  if (term.length < 4 || term.length > 40) return false;
  const tolerance = term.length < 8 ? 1 : 2;
  const target = word.length > term.length + tolerance ? word.slice(0, term.length) : word;
  if (Math.abs(term.length - target.length) > tolerance) return false;

  // Count an adjacent swap as one edit, for common typos such as "sunnha".
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (let row = 1; row <= term.length; row++) {
    const current = [row];
    for (let column = 1; column <= target.length; column++) {
      const substitution = term[row - 1] === target[column - 1] ? 0 : 1;
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + substitution);
      if (row > 1 && column > 1 && term[row - 1] === target[column - 2] && term[row - 2] === target[column - 1]) {
        current[column] = Math.min(current[column], beforePrevious[column - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[target.length] <= tolerance;
}

export function rankRegistrationInstitutions(options: RegistrationInstitutionSuggestion[], search: string) {
  const terms = search.split(" ");
  const compactSearch = terms.join("");

  function rank(option: RegistrationInstitutionSuggestion) {
    if (!search) return 0;
    const name = registrationInstitutionSearchKey(option.name);
    const nameWords = name.split(" ");
    const compactName = nameWords.join("");
    if (compactName === compactSearch) return 0;
    if (compactName.startsWith(compactSearch)) return 1;
    if (compactSearch.length >= 2 && nameWords.map((word) => word[0]).join("") === compactSearch) return 2;
    if (terms.every((term) => containsWord(nameWords, term))) return 3;

    const words = [...nameWords, ...registrationInstitutionSearchKey(option.region ?? "").split(" ")];
    if (terms.every((term) => containsWord(words, term))) return 4;
    if (terms.every((term) => containsWord(words, term) || words.some((word) => hasSmallTypo(term, word)))) return 5;
    return Infinity;
  }

  return options.map((option) => ({ option, rank: rank(option) })).filter((match) => Number.isFinite(match.rank))
    .sort((a, b) => a.rank - b.rank || byLabel.compare(a.option.name, b.option.name)
      || byLabel.compare(a.option.region ?? "", b.option.region ?? "") || a.option.id.localeCompare(b.option.id))
    .map(({ option }) => option);
}
