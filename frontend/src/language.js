export class LanguageDetector {
    constructor() {
        // Die Reihenfolge im Array bestimmt die Priorität (Spezifisch -> Allgemein)
        this.rules = [
            { tag: '//c#', keywords: ['c#'] },
            { tag: 'cpp', keywords: ['c++', 'cpp'] },
            { tag: '//ts', keywords: ['typescript', '.ts', 'tsx'] },
            { 
                tag: 'go', 
                test: (l) => l.includes('go ') || l.includes('golang') || l.includes('func main()') || l.includes('package ') 
            },
            { 
                tag: '//js', 
                keywords: ['javascript', 'js ', 'node.js', '.js', 'console.log', 'function()', 'const ', 'let ', 'var '] 
            },
            { 
                tag: '//py', 
                keywords: ['python', 'py ', '.py', 'import ', 'def ', 'print(', 'numpy', 'pandas'] 
            },
            { 
                tag: 'html', 
                keywords: ['html', '<div', '<html', '<!doctype', '<body', '</', '<p>', '<span'] 
            },
            { 
                tag: 'css', 
                test: (l) => l.includes('css') || (l.includes('{') && l.includes('}') && 
                             (l.includes('color:') || l.includes('margin:') || l.includes('padding:') || l.includes('font-') || l.includes('.css')))
            },
            { tag: 'rust', keywords: ['rust', 'fn main()', 'let mut', 'println!'] },
            { tag: 'java', keywords: ['java', 'public class', 'system.out.print', '.java', 'void main'] },
            { 
                tag: 'c', 
                test: (l) => l.includes(' c ') || l.includes('c program') || l.includes('#include <stdio.h>') || 
                             l.includes('printf(') || (l.includes('int main') && !l.includes('c++'))
            },
            { 
                tag: 'ruby', 
                test: (l) => l.includes('ruby') || l.includes('rb ') || (l.includes('def ') && l.includes('end')) || l.includes('puts ') || l.includes('require ') 
            },
            { tag: 'php', keywords: ['php', '<?php', '$_', 'echo '] },
            { 
                tag: 'swift', 
                test: (l) => l.includes('swift') || (l.includes('func ') && l.includes('var ') && l.includes(': ')) 
            },
            { tag: 'kotlin', keywords: ['kotlin', 'fun ', 'val ', 'println('] },
            { tag: 'sql', keywords: ['sql', 'select ', 'from ', 'where ', 'insert into', 'update '] },
            { tag: 'bash', keywords: ['bash', 'shell', '#!', '#!/bin/', 'echo ', '$'] },
            { tag: 'markdown', keywords: ['markdown', '# ', '## ', '* ', '- [ ]'] },
            { 
                tag: 'json', 
                test: (l) => (l.includes('{') && l.includes('}')) && (l.includes('": "') || l.includes('": [')) 
            },
            { 
                tag: 'yaml', 
                test: (l) => l.includes('yaml') || (l.includes(': ') && (l.includes('\n  ') || l.includes('- '))) 
            },
            { 
                tag: 'docker', 
                test: (l) => l.includes('docker') || (l.includes('from ') && l.includes('copy ') || l.includes('run ')) 
            },
            { 
                tag: 'graphql', 
                test: (l) => l.includes('graphql') || (l.includes('query ') || (l.includes('{') && l.includes('}') && l.includes(':'))) 
            },
            { tag: 'assembly', keywords: ['assembly', 'asm ', 'mov ', 'eax,'] },
            { tag: 'r', keywords: [' r ', 'r studio', '<-', 'data.frame'] },
            { 
                tag: 'matlab', 
                test: (l) => l.includes('matlab') || (l.includes('function ') && l.includes('end') && l.includes('%')) 
            },
            { tag: 'dart', keywords: ['dart', 'flutter', 'void main()', 'widget'] },
            { 
                tag: 'lua', 
                test: (l) => l.includes('lua') || (l.includes('function ') && l.includes('end') && l.includes('local ')) 
            },
            { tag: 'powershell', keywords: ['powershell', 'ps1', 'get-', '$'] },
            { 
                tag: 'scala', 
                test: (l) => l.includes('scala') || l.includes('object ') || (l.includes('def ') && l.includes(': ')) 
            },
            { tag: 'perl', keywords: ['perl', '#!/usr/bin/perl', 'my $', 'print '] },
            { tag: 'fortran', keywords: ['fortran', 'program ', 'integer', 'write(*,*'] },
            { tag: 'haskell', keywords: ['haskell', ':: ', '->', 'let '] },
            { 
                tag: 'elixir', 
                test: (l) => l.includes('elixir') || l.includes('defmodule ') || (l.includes('def ') && l.includes('do')) 
            },
            { tag: 'clojure', keywords: ['clojure', '(defn ', '(println ', '))'] },
            { tag: 'fsharp', test: (l) => l.includes('f#') || (l.includes('let ') && l.includes('->')) },
            { tag: 'objective-c', keywords: ['objective-c', 'objc', '@interface', '[self '] },
            { 
                tag: 'groovy', 
                test: (l) => l.includes('groovy') || (l.includes('def ') && l.includes('println ') && !l.includes('java')) 
            },
            { 
                tag: 'julia', 
                test: (l) => l.includes('julia') || (l.includes('function ') && l.includes('end') && l.includes('println(')) 
            },
            { tag: 'ada', keywords: ['ada', 'procedure ', 'begin', 'end '] },
            { tag: 'prolog', keywords: ['prolog', ':-', '.'] },
            { tag: 'verilog', keywords: ['verilog', 'vhdl', 'module ', 'entity '] }
        ];
    }

    /**
     * Erkennt die Programmiersprache basierend auf dem Prompt.
     * @param {string} prompt 
     * @returns {string} Die erkannte Sprache oder 'general'
     */
    detect(prompt) {
        if (!prompt) return 'general';
        
        const lower = prompt.toLowerCase();

        for (const rule of this.rules) {
            // Check via Keyword-Liste
            if (rule.keywords && rule.keywords.some(kw => lower.includes(kw))) {
                return rule.tag;
            }
            // Check via benutzerdefinierter Test-Funktion (für komplexe Logik)
            if (rule.test && rule.test(lower)) {
                return rule.tag;
            }
        }

        // Spezieller Fall für C am Ende (wie im Original)
        if (lower.includes('c ') && !lower.includes('c#') && !lower.includes('c++')) {
            return 'c';
        }

        return 'general';
    }
}

// Beispiel-Anwendung:
    // const detector = new LanguageDetector();
    // console.log(detector.detect("How to write a function in Python?")); // Output: //py
    // console.log(detector.detect("SELECT * FROM users"));                // Output: sql