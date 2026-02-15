import {
    printErrors,
    scanURLs,
    validateFiles,
    readFiles,
} from 'next-validate-link';
import { readFileSync } from 'fs';

/**
 * Extract all anchor IDs from a markdown file
 */
function extractAnchors(content: string): Set<string> {
    const anchors = new Set<string>();
    // Match all anchor tags like [#anchor]
    const anchorRegex = /\[#([^\]]+)\]/g;
    let match;
    while ((match = anchorRegex.exec(content)) !== null) {
        anchors.add(match[1]);
    }
    return anchors;
}

/**
 * Validates all links in documentation files
 * checking for:
 * - Broken internal links
 * - Invalid anchor links (#hashes)
 * - Missing href attributes in MDX components
 */
async function checkLinks() {
    console.log('🔍 Scanning URLs from Next.js routes...\n');

    // Scan all available URLs from the Next.js file-system based routing
    const scanned = await scanURLs({
        preset: 'next',
    });

    console.log('📝 Reading content files...\n');

    // Read all MDX/MD files from content directories
    const files = await readFiles([
        'content/fcp/**/*.{md,mdx}',
    ]);

    console.log(`📚 Found ${files.length} content files\n`);

    console.log('🔗 Validating links...\n');

    const errors = await validateFiles(files, {
        scanned,
        // Base URL for resolving relative paths - including basePath
        baseUrl: 'http://localhost:3000/docs',
        markdown: {
            components: {
                // Validate href attributes in common MDX components
                Card: { attributes: ['href'] },
                Link: { attributes: ['href'] },
                Cards: { attributes: ['href'] },
                SmartDocsCard: { attributes: ['href'] },
            },
        },
        // Validate relative paths as URLs (more strict)
        checkRelativePaths: 'as-url',
    });

    printErrors(errors, true);

    // Initial anchor validation
    console.log('🔗 Validating anchors...\n');

    const anchorErrors: Array<{
        file: string;
        line?: number;
        message: string;
        url?: string;
    }> = [];

    // Build a map of file paths to their anchors
    const fileAnchors = new Map<string, Set<string>>();
    for (const file of files) {
        const filePath = typeof file === 'string' ? file : file.path;
        const content = typeof file === 'string' ? readFileSync(filePath, 'utf-8') : file.content;
        const anchors = extractAnchors(content);
        fileAnchors.set(filePath, anchors);
    }

    // Check for anchor links
    for (const file of files) {
        const filePath = typeof file === 'string' ? file : file.path;
        const content = typeof file === 'string' ? readFileSync(filePath, 'utf-8') : file.content;
        const lines = content.split('\n');

        // Look for links with anchors
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        lines.forEach((line, index) => {
            let match;
            while ((match = linkRegex.exec(line)) !== null) {
                const linkText = match[1];
                const linkUrl = match[2];

                // Check for internal links with anchors
                if (linkUrl.startsWith('/docs/') && linkUrl.includes('#')) {
                    const [path, anchor] = linkUrl.split('#');

                    // Try to find the target file
                    let targetFile = null;
                    const normalizedPath = path.replace('/docs/', '');

                    for (const f of files) {
                        const fPath = typeof f === 'string' ? f : f.path;
                        // Match file system path (content/docs/...) to link path
                        if (fPath.includes(normalizedPath)) {
                            // Handle index files
                            if (fPath.endsWith('index.mdx') || fPath.endsWith(`${normalizedPath}.mdx`)) {
                                targetFile = fPath;
                                break;
                            }
                        }
                    }

                    if (targetFile) {
                        const anchors = fileAnchors.get(targetFile);
                        if (anchors && !anchors.has(anchor)) {
                            anchorErrors.push({
                                file: filePath,
                                line: index + 1,
                                message: `Broken anchor link: "${linkText}" → ${linkUrl} (anchor "${anchor}" not found in ${path})`,
                                url: linkUrl,
                            });
                        }
                    }
                }
            }
        });
    }

    if (anchorErrors.length > 0) {
        console.error(`\n❌ Found ${anchorErrors.length} broken anchor(s):\n`);
        anchorErrors.forEach(error => {
            console.error(`  ${error.file}${error.line ? `:${error.line}` : ''}`);
            console.error(`    ${error.message}\n`);
        });
    }

    const totalErrors = errors.length + anchorErrors.length;

    if (totalErrors > 0) {
        console.error(`\n❌ Found ${totalErrors} validation error(s)\n`);
        process.exit(1);
    } else {
        console.log('✅ All links and anchors are valid!\n');
    }
}

// Run the link checker
void checkLinks();
