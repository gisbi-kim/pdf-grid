/* Pure PDF operations: input bytes and page selections are never modified. */
(function (root) {
  'use strict';
  function parsePages(value, count) {
    if (!Number.isInteger(count) || count < 1) throw new Error('PDF에 페이지가 없습니다.');
    if (!value.trim()) return Array.from({length: count}, (_, i) => i);
    const pages = [];
    for (const part of value.split(',')) {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error('쪽 번호는 1-3, 5처럼 입력해 주세요.');
      const start = Number(match[1]), end = Number(match[2] || match[1]);
      if (start < 1 || end > count || start > end) throw new Error(`1~${count}쪽 사이에서 작은 번호부터 입력해 주세요.`);
      for (let n = start; n <= end; n++) pages.push(n - 1);
      if (pages.length > 20000) throw new Error('한 번에 최대 20,000쪽까지 선택할 수 있습니다.');
    }
    return pages;
  }
  function splitGroups(value, count, eachPage) {
    if (eachPage) return Array.from({length: count}, (_, i) => [i]);
    if (!value.trim() || value.split(';').some(group => !group.trim())) throw new Error('분리할 쪽을 입력해 주세요. 예: 1-3; 4-5');
    return value.split(';').map(group => parsePages(group, count));
  }
  async function loadPDF(bytes, lib) {
    try {
      const doc = await lib.PDFDocument.load(bytes.slice());
      if (!doc.getPageCount()) throw new Error('페이지가 없는 PDF입니다.');
      return doc;
    } catch (error) {
      if (/encrypt/i.test(error.message)) throw new Error('암호화된 PDF는 편집할 수 없습니다. 암호를 해제한 파일을 선택해 주세요.');
      throw error;
    }
  }
  async function combine(sources, lib) {
    const output = await lib.PDFDocument.create();
    for (const source of sources) {
      const input = await loadPDF(source.bytes, lib);
      const indexes = parsePages(source.range || '', input.getPageCount());
      const pages = await output.copyPages(input, indexes);
      for (const page of pages) output.addPage(page);
    }
    if (!output.getPageCount()) throw new Error('PDF 파일을 먼저 추가해 주세요.');
    return output.save();
  }
  async function extract(bytes, indexes, lib) {
    const input = await loadPDF(bytes, lib);
    if (!indexes.length || indexes.some(i => !Number.isInteger(i) || i < 0 || i >= input.getPageCount())) throw new Error('잘못된 페이지 선택입니다.');
    const output = await lib.PDFDocument.create();
    const pages = await output.copyPages(input, indexes);
    pages.forEach(page => output.addPage(page));
    return output.save();
  }
  const api = {parsePages, splitGroups, loadPDF, combine, extract};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PDFGridTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
