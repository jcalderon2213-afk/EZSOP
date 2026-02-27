/**
 * EZSOP Knowledge Base Seeder
 * 
 * Reads all .md files from C:\Users\jcald\afh-database,
 * parses YAML frontmatter, and inserts them into Supabase knowledge_items.
 *
 * SETUP:
 *   1. Copy this file to C:\Users\jcald\EZSOP\seed-knowledge-base.mjs
 *   2. cd C:\Users\jcald\EZSOP
 *   3. npm install @supabase/supabase-js
 *   4. Open this file in Notepad and paste your service_role key on line 17
 *   5. Run: node seed-knowledge-base.mjs
 */

// === PASTE YOUR KEYS HERE ===
const SUPABASE_URL = "https://adlfdivbrwgasflftbpx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE";
const ORG_ID = "5b7fa008-0e81-434f-8fa3-9a39497e132a";
// ============================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename, dirname } from "path";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AFH_DATABASE_PATH = "C:\\Users\\jcald\\afh-database";

// Map folder names to category, level, priority, and type
const FOLDER_CONFIG = {
  "forms": {
    category: "forms",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
  "tools-and-resources": {
    category: "tools-and-resources",
    level: "state",
    priority: "RECOMMENDED",
    type: "LINK",
  },
  "rules-and-policies": {
    category: "rules-and-policies",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
  "employment-labor": {
    category: "employment-labor",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
  "medicaid": {
    category: "medicaid",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
  "insurance": {
    category: "insurance",
    level: "state",
    priority: "RECOMMENDED",
    type: "DOCUMENT",
  },
  "financial": {
    category: "financial",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
  "documentation": {
    category: "documentation",
    level: "internal",
    priority: "RECOMMENDED",
    type: "DOCUMENT",
  },
  "building-safety": {
    category: "building-safety",
    level: "state",
    priority: "REQUIRED",
    type: "DOCUMENT",
  },
};

// Parse YAML frontmatter from markdown content
function parseFrontmatter(content) {
  // Handle files that start with frontmatter without leading ---
  // Check if file starts with "title:" (no leading ---)
  let frontmatterBlock;
  let body;

  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end === -1) return { frontmatter: {}, body: content };
    frontmatterBlock = content.slice(3, end).trim();
    body = content.slice(end + 3).trim();
  } else if (content.startsWith("title:")) {
    // Frontmatter without leading ---, ends at first ---
    const end = content.indexOf("---");
    if (end === -1) return { frontmatter: {}, body: content };
    frontmatterBlock = content.slice(0, end).trim();
    body = content.slice(end + 3).trim();
  } else {
    return { frontmatter: {}, body: content };
  }

  const frontmatter = {};
  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// Recursively find all .md files (skip index.md files)
function findMarkdownFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip pdfs directory
      if (entry === "pdfs") continue;
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.endsWith(".md") && entry !== "index.md") {
      results.push(fullPath);
    }
  }

  return results;
}

async function main() {
  console.log("=== EZSOP Knowledge Base Seeder ===\n");

  // Validate key is set
  if (SUPABASE_SERVICE_ROLE_KEY === "PASTE_YOUR_SERVICE_ROLE_KEY_HERE") {
    console.error("ERROR: You need to paste your service_role key on line 17.");
    console.error("Find it in Supabase Dashboard > Settings > API > service_role");
    process.exit(1);
  }

  // Find all markdown files
  const files = findMarkdownFiles(AFH_DATABASE_PATH);
  console.log(`Found ${files.length} markdown files.\n`);

  const records = [];
  let skipped = 0;

  for (const filePath of files) {
    const rawContent = readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(rawContent);
    const relPath = relative(AFH_DATABASE_PATH, filePath);
    const folder = relPath.split("\\")[0].split("/")[0];
    const config = FOLDER_CONFIG[folder];

    if (!config) {
      console.log(`  SKIP (no folder config): ${relPath}`);
      skipped++;
      continue;
    }

    const title = frontmatter.title || basename(filePath, ".md").replace(/-/g, " ");
    const description = frontmatter.description || null;
    const sourceUrl = frontmatter.source_url || null;

    records.push({
      org_id: ORG_ID,
      title: title,
      description: description,
      type: config.type,
      priority: config.priority,
      level: config.level,
      category: config.category,
      suggested_source: sourceUrl,
      provided_url: sourceUrl,
      provided_text: body,
      status: "learned",
      sort_order: records.length,
    });
  }

  console.log(`\nPrepared ${records.length} records (${skipped} skipped).\n`);

  // Insert in batches of 20
  const BATCH_SIZE = 20;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    const { data, error } = await supabase
      .from("knowledge_items")
      .insert(batch)
      .select("id, title");

    if (error) {
      console.error(`  ERROR batch ${batchNum}/${totalBatches}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += data.length;
      console.log(`  Batch ${batchNum}/${totalBatches}: inserted ${data.length} items`);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors:   ${errors}`);
  console.log(`Skipped:  ${skipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
