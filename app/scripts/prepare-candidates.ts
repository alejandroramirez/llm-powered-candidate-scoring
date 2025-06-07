import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { htmlToText } from 'html-to-text';

type RawCandidate = Record<string, string>;

interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string;
}

const clean = (value: string): string =>
  htmlToText(value, { wordwrap: false }).toLowerCase().trim();

const buildResume = (row: RawCandidate): string => {
  const resumeParts: string[] = [];

  for (const [key, value] of Object.entries(row)) {
    if (!value || !value.trim()) continue;

    if (key.toLowerCase().startsWith('question')) {
      const n = key.match(/\d+/)?.[0];
      const answer = row[`Answer ${n}`];
      if (!answer || !answer.trim()) continue;
      resumeParts.push(`${clean(key)}: ${clean(value)}`);
      resumeParts.push(`answer ${n}: ${clean(answer)}`);
    } else if (!key.toLowerCase().startsWith('answer')) {
      resumeParts.push(`${clean(key)}: ${clean(value)}`);
    }
  }

  return resumeParts.join('\n');
};

const normalize = (row: RawCandidate, index: number): Candidate => {
  const name = clean(row['Name'] || `unknown-${index}`);
  const jobTitle = clean(row['Job title'] || 'unknown');
  const resume = buildResume(row);

  return {
    id: row['id'] || `candidate-${index}`,
    name,
    jobTitle,
    resume
  };
};

const csvPath = path.join(__dirname, '../assets/candidates.csv');
const jsonPath = path.join(__dirname, '../public/candidates.json');

const rawCsv = fs.readFileSync(csvPath, 'utf8');
const parsed: RawCandidate[] = parse(rawCsv, { columns: true });

const candidates = parsed.map(normalize);

// Optional: deduplicate by name + jobTitle
const deduped = Array.from(
  new Map(candidates.map(c => [`${c.name}|${c.jobTitle}`, c])).values()
);

fs.writeFileSync(jsonPath, JSON.stringify(deduped, null, 2));
console.log(`✅ Wrote ${deduped.length} candidates to public/candidates.json`);


// Preview a few sample candidates
console.log('\n📋 Preview (first 2 candidates):\n');
deduped.slice(0, 2).forEach((c, i) => {
  console.log(`Candidate ${i + 1}:`);
  console.log(JSON.stringify(c, null, 2));
  console.log('---');
});
