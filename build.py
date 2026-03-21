#!/usr/bin/env python3
"""Build script to bundle index.html + CSS + JS into index.bundle.html"""

import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CSS_FILES = [
    'css/variables.css',
    'css/base.css',
    'css/components.css',
    'css/layout.css',
    'css/gantt.css',
    'css/settings-panel.css',
    'css/responsive.css',
]

JS_FILES = [
    'js/utils.js',
    'js/store.js',
    'js/theme.js',
    'js/task-modal.js',
    'js/gantt-renderer.js',
    'js/gantt-interactions.js',
    'js/onboarding.js',
    'js/cloud-backup.js',
    'js/settings-panel.js',
    'js/app.js',
]

def read_file(path):
    with open(os.path.join(BASE_DIR, path), 'r', encoding='utf-8') as f:
        return f.read()

def strip_imports_exports(js_content):
    """Remove ES module import/export statements."""
    lines = js_content.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Skip import lines (single and multiline)
        if stripped.startswith('import '):
            # Check if it's a multiline import
            if '{' in stripped and '}' not in stripped:
                # Multiline import - skip until closing brace + from
                while i < len(lines) and "from " not in lines[i].strip()[-30:] if '}' not in lines[i] else False:
                    i += 1
                i += 1  # skip the closing line too
                # Find the line with the closing } and from
                while i < len(lines):
                    if '}' in lines[i] and 'from' in lines[i]:
                        i += 1
                        break
                    elif 'from' in lines[i].strip():
                        i += 1
                        break
                    i += 1
                continue
            else:
                i += 1
                continue

        # Skip export default
        if stripped.startswith('export default '):
            result.append(line.replace('export default ', ''))
            i += 1
            continue

        # Skip export { ... }
        if stripped.startswith('export {'):
            # Could be multiline
            if '}' not in stripped:
                while i < len(lines) and '}' not in lines[i]:
                    i += 1
            i += 1
            continue

        # Replace "export function" with "function"
        if stripped.startswith('export function '):
            result.append(line.replace('export function ', 'function '))
            i += 1
            continue

        # Replace "export class" with "class"
        if stripped.startswith('export class '):
            result.append(line.replace('export class ', 'class '))
            i += 1
            continue

        # Replace "export const" with "const"
        if stripped.startswith('export const '):
            result.append(line.replace('export const ', 'const '))
            i += 1
            continue

        # Replace "export let" with "let"
        if stripped.startswith('export let '):
            result.append(line.replace('export let ', 'let '))
            i += 1
            continue

        result.append(line)
        i += 1

    return '\n'.join(result)

def build():
    # Read the HTML template
    html = read_file('index.html')

    # Build CSS bundle
    css_parts = []
    for css_file in CSS_FILES:
        content = read_file(css_file)
        css_parts.append(f'/* ====== {css_file} ====== */')
        css_parts.append(content)
    css_bundle = '\n'.join(css_parts)

    # Build JS bundle
    js_parts = []
    for js_file in JS_FILES:
        content = read_file(js_file)
        content = strip_imports_exports(content)
        js_parts.append(f'// ====== {js_file} ======')
        js_parts.append(content)
    js_bundle = '\n'.join(js_parts)

    # Build the HTML using string replacement (not regex, to avoid backslash issues)
    # Replace CSS links with inline style
    css_marker_start = '    <!-- Styles -->'
    css_marker_end = '</head>'
    css_start_idx = html.index(css_marker_start)
    css_end_idx = html.index(css_marker_end, css_start_idx)
    html = html[:css_start_idx] + f'    <style>\n{css_bundle}\n    </style>\n' + html[css_end_idx:]

    # Replace the module script tag with inline IIFE
    script_marker = '    <script type="module" src="js/app.js"></script>'
    script_idx = html.index(script_marker)
    html = html[:script_idx] + f'    \n    <script>\n(function() {{\n"use strict";\n\n{js_bundle}\n\n}})();\n    </script>' + html[script_idx + len(script_marker):]

    # Write the bundle
    output_path = os.path.join(BASE_DIR, 'index.bundle.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    line_count = html.count('\n') + 1
    print(f'Built index.bundle.html ({line_count} lines)')

if __name__ == '__main__':
    build()
