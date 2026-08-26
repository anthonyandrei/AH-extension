import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.join(__dirname, '../styles/popup.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

describe('popup.css hygiene and unused rules cleanup', () => {
  describe('unused custom properties', () => {
    it('does not declare unused --r-lg custom property in :root', () => {
      assert.equal(
        cssContent.includes('--r-lg'),
        false,
        'popup.css must not define or reference --r-lg'
      );
    });

    it('does not declare unused --z-sheet custom property in :root', () => {
      assert.equal(
        cssContent.includes('--z-sheet'),
        false,
        'popup.css must not define or reference --z-sheet'
      );
    });

    it('does not declare unused --z-bar custom property in :root', () => {
      assert.equal(
        cssContent.includes('--z-bar'),
        false,
        'popup.css must not define or reference --z-bar'
      );
    });
  });

  describe('unused selectors', () => {
    it('does not contain .hdr .sub selector', () => {
      assert.equal(
        cssContent.includes('.hdr .sub'),
        false,
        'popup.css must not include .hdr .sub'
      );
    });

    it('does not contain .pip selector', () => {
      assert.equal(
        cssContent.includes('.pip'),
        false,
        'popup.css must not include .pip'
      );
    });

    it('does not contain legacy .tabs or .tab selectors', () => {
      // Must not match .tabs or .tab as class selectors (only .b-tabs, .b-tab should remain)
      assert.equal(
        /\.tabs\b/.test(cssContent),
        false,
        'popup.css must not include legacy .tabs selector'
      );
      assert.equal(
        /\.tab\b/.test(cssContent),
        false,
        'popup.css must not include legacy .tab selector'
      );
    });

    it('does not contain legacy .plan-table selector', () => {
      assert.equal(
        cssContent.includes('plan-table'),
        false,
        'popup.css must not include legacy .plan-table selector'
      );
    });

    it('does not contain legacy .btn-remove selector', () => {
      assert.equal(
        cssContent.includes('btn-remove'),
        false,
        'popup.css must not include legacy .btn-remove selector'
      );
    });
  });

  describe('chip data-tone rules consolidation', () => {
    it('merges live and done tones into a single shared rule', () => {
      // .chip[data-tone="live"] and .chip[data-tone="done"] should be merged into one comma-separated selector
      const liveAndDoneRule = /\.chip\[data-tone="live"\]\s*,\s*\.chip\[data-tone="done"\]|\.chip\[data-tone="done"\]\s*,\s*\.chip\[data-tone="live"\]/;
      assert.equal(
        liveAndDoneRule.test(cssContent),
        true,
        'popup.css must merge live and done chip tones into one shared rule'
      );
    });

    it('does not contain duplicate separate .chip[data-tone="done"] rule block', () => {
      const separateDone = /^[ \t]*\.chip\[data-tone="done"\]\s*\{/m;
      assert.equal(
        separateDone.test(cssContent),
        false,
        'popup.css must not contain a standalone separate rule block for done'
      );
    });
  });

  describe('retained active selectors and variables integrity', () => {
    it('retains essential tab classes .b-tabs and .b-tab', () => {
      assert.equal(cssContent.includes('.b-tabs'), true);
      assert.equal(cssContent.includes('.b-tab'), true);
    });

    it('retains essential plan table class table.b-plan', () => {
      assert.equal(cssContent.includes('table.b-plan'), true);
    });

    it('retains essential remove button class .b-x', () => {
      assert.equal(cssContent.includes('.b-x'), true);
    });

    it('retains all standard color and radius variables used by active components', () => {
      assert.equal(cssContent.includes('--accent:'), true);
      assert.equal(cssContent.includes('--amber:'), true);
      assert.equal(cssContent.includes('--red:'), true);
      assert.equal(cssContent.includes('--blue:'), true);
      assert.equal(cssContent.includes('--r-sm:'), true);
      assert.equal(cssContent.includes('--r-md:'), true);
    });
  });
});
