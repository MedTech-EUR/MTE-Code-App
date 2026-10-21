import assert from 'node:assert/strict';
import test from 'node:test';

import { checkHtml, htmlToText } from '../public/admin/lib/html-tools.js';

const messages = (html) => checkHtml(html).map((problem) => problem.message);

test('checkHtml accepts well-formed HTML as the Code stores it', () => {
  assert.deepEqual(messages('<p><strong>1.1.</strong> Text<br/>more<br>and <a href="/code/ch4#a" title="a > b">a link</a>.</p><!-- note <b> -->'), []);
  assert.deepEqual(messages('<ul><li>One</li><li>Two</li></ul><img src="/x.png" alt="">'), []);
  assert.deepEqual(messages('Plain text, with < and > signs used as comparisons: 3 < 4.'), []);
});

test('checkHtml names tags that are not closed, closed twice or out of order', () => {
  assert.deepEqual(messages('<p><strong>Bold</p>'), ['<strong> (line 1) is not closed before </p>.']);
  assert.deepEqual(messages('<p>Text</p></p>'), ['</p> closes a <p> that was never opened.']);
  assert.deepEqual(messages('<p>Text'), ['<p> (line 1) is never closed.']);
  assert.deepEqual(messages('<p>a<br></br></p>'), ['</br> is not needed: <br> has no closing tag.']);
  assert.deepEqual(messages('<p>a <strong class="x"</p>'), ['There is an incomplete tag (a “<” that is never finished).']);
  assert.equal(checkHtml('<div>\n<p>\nText\n</div>')[0].line, 2);
});

test('htmlToText gives the text a reader sees, a line per paragraph or item', () => {
  assert.equal(htmlToText('<p><strong>1.1.</strong> Member&nbsp;Companies&rsquo; grants</p><p>Second</p>'), '1.1. Member Companies’ grants\nSecond');
  assert.equal(htmlToText('<ul><li>One</li><li>Two</li></ul>'), '• One\n• Two');
  assert.equal(htmlToText('Line<br/>break'), 'Line\nbreak');
  assert.equal(htmlToText('<table><tr><td>A</td><td>B</td></tr></table>'), 'A | B');
});
