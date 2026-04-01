#!/usr/bin/env python3
"""Build script to bundle index.html + CSS + JS into gantt-planner-vX.Y.html"""

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
    'js/i18n.js',
    'js/utils.js',
    'js/store.js',
    'js/theme.js',
    'js/task-modal.js',
    'js/gantt-renderer.js',
    'js/gantt-interactions.js',
    'js/onboarding.js',
    'js/cloud-backup.js',
    'js/onedrive-backup.js',
    'js/settings-panel.js',
    'js/app.js',
]

def read_file(path):
    with open(os.path.join(BASE_DIR, path), 'r', encoding='utf-8') as f:
        return f.read()

def strip_imports_exports(js_content):
    """Remove ES module import/export statements using regex."""
    # Remove single-line imports: import ... from '...';
    js_content = re.sub(r"^\s*import\s+.*?from\s+['\"].*?['\"];?\s*$", '', js_content, flags=re.MULTILINE)
    # Remove multiline imports: import {\n  ...\n} from '...';
    js_content = re.sub(r"^\s*import\s*\{[^}]*\}\s*from\s*['\"].*?['\"];?\s*$", '', js_content, flags=re.MULTILINE | re.DOTALL)
    # Remove side-effect imports: import './foo.js';
    js_content = re.sub(r"^\s*import\s+['\"].*?['\"];?\s*$", '', js_content, flags=re.MULTILINE)

    # Replace "export default " with ""
    js_content = re.sub(r"^\s*export\s+default\s+", '', js_content, flags=re.MULTILINE)
    # Remove "export { ... }" blocks (single and multiline)
    js_content = re.sub(r"^\s*export\s*\{[^}]*\};?\s*$", '', js_content, flags=re.MULTILINE | re.DOTALL)
    # Replace "export function" with "function"
    js_content = re.sub(r"^(\s*)export\s+function\s", r"\1function ", js_content, flags=re.MULTILINE)
    # Replace "export class" with "class"
    js_content = re.sub(r"^(\s*)export\s+class\s", r"\1class ", js_content, flags=re.MULTILINE)
    # Replace "export const" with "const"
    js_content = re.sub(r"^(\s*)export\s+const\s", r"\1const ", js_content, flags=re.MULTILINE)
    # Replace "export let" with "let"
    js_content = re.sub(r"^(\s*)export\s+let\s", r"\1let ", js_content, flags=re.MULTILINE)

    return js_content

def get_version():
    version_path = os.path.join(BASE_DIR, 'VERSION')
    with open(version_path, 'r', encoding='utf-8') as f:
        return f.read().strip()

def build():
    version = get_version()
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
    output_name = f'gantt-planner-v{version}.html'
    output_path = os.path.join(BASE_DIR, output_name)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    line_count = html.count('\n') + 1
    print(f'Built {output_name} ({line_count} lines)')

if __name__ == '__main__':
    build()
