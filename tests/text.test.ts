import assert from "node:assert/strict";
import test from "node:test";
import { decodeHtmlEntities } from "../lib/text.ts";

test("PubMed 저자명의 16진수 숫자 엔터티를 유니코드로 변환한다", () => {
  assert.equal(
    decodeHtmlEntities(
      "Martin B&#xfc;chsel, Katharina Lisko, Hanna G&#xf6;lz, J&#xfc;rgen Bardutzky, Heinz Wiendl, Sa&#xfa;l Beltr&#xe1;n Felipa",
    ),
    "Martin Büchsel, Katharina Lisko, Hanna Gölz, Jürgen Bardutzky, Heinz Wiendl, Saúl Beltrán Felipa",
  );
});

test("이중 인코딩된 숫자와 기본 명명 엔터티를 함께 변환한다", () => {
  assert.equal(
    decodeHtmlEntities("A &amp; B &amp;#x2013; C &#160; D"),
    "A & B – C   D",
  );
});
