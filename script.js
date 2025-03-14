// ファイル読み込みとドラッグ＆ドロップの設定
document.addEventListener('DOMContentLoaded', function () {
  const dropArea = document.getElementById('drop-area');
  const output = document.getElementById('output');
  const codeOutput = document.getElementById('code-output');
  const toggleFormatBtn = document.getElementById('toggle-format');
  const downloadBtn = document.getElementById('download-btn');
  let currentXML = '';
  let currentJSON = '';
  let xmlDisplayed = true;

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('hover');
  });

  dropArea.addEventListener('dragleave', (e) => {
    dropArea.classList.remove('hover');
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('hover');

    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const arrayBuffer = event.target.result;
        const byteArray = new Uint8Array(arrayBuffer);

        // 気象庁の識別子が付与されたファイルから GZIP のマジックナンバー (0x1F,0x8B) を検索
        let offset = 0;
        for (let i = 0; i < byteArray.length - 1; i++) {
          if (byteArray[i] === 0x1f && byteArray[i + 1] === 0x8b) {
            offset = i;
            break;
          }
        }
        const gzipData = byteArray.slice(offset);
        try {
          // GZIP 解凍（pako ライブラリ使用）
          const decompressed = pako.ungzip(gzipData, { to: 'string' });
          // XML の整形 (vkbeautifyを使用)
          currentXML = vkbeautify.xml(decompressed, 2);
          codeOutput.textContent = currentXML;
          hljs.highlightElement(codeOutput);

          toggleFormatBtn.style.display = 'inline-block';
          toggleFormatBtn.textContent = 'JSON表示に切替';

          downloadBtn.style.display = 'inline-block';
          xmlDisplayed = true;
          // XML → JSON へ変換（事前に整形済みのXMLから変換）
          currentJSON = xmlToJson(currentXML);
        } catch (err) {
          codeOutput.textContent = '解凍エラー: ' + err;
        }
      };
      reader.readAsArrayBuffer(file);
    }
  });

  toggleFormatBtn.addEventListener('click', () => {
    if (xmlDisplayed) {
      codeOutput.textContent = JSON.stringify(currentJSON, null, 2);
      codeOutput.className = 'language-json';
      toggleFormatBtn.textContent = 'XML表示に切替';
      xmlDisplayed = false;
    } else {
      codeOutput.textContent = currentXML;
      codeOutput.className = 'language-xml';
      toggleFormatBtn.textContent = 'JSON表示に切替';
      xmlDisplayed = true;
    }
    hljs.highlightElement(codeOutput);
  });
  downloadBtn.addEventListener('click', () => {
    const contentToDownload = xmlDisplayed ? currentXML : JSON.stringify(currentJSON, null, 2);
    const filename = xmlDisplayed ? 'document.xml' : 'document.json';
    const blob = new Blob([contentToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// シンプルな XML → JSON 変換関数
function xmlToJson(xmlStr) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XMLパースエラー');
    }
    const obj = {};
    function traverse(node, obj) {
      if (node.nodeType === 1) {
        // 要素ノード
        if (!obj[node.nodeName]) {
          obj[node.nodeName] = {};
        }
        if (node.attributes && node.attributes.length > 0) {
          obj[node.nodeName]['@attributes'] = {};
          for (let i = 0; i < node.attributes.length; i++) {
            const attribute = node.attributes.item(i);
            obj[node.nodeName]['@attributes'][attribute.nodeName] = attribute.nodeValue;
          }
        }
        if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
          obj[node.nodeName] = node.childNodes[0].nodeValue;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes.item(i);
            if (child.nodeType === 3) {
              if (child.nodeValue.trim()) {
                obj[node.nodeName] = child.nodeValue;
              }
            } else {
              if (!obj[node.nodeName][child.nodeName]) {
                obj[node.nodeName][child.nodeName] = [];
              }
              const childObj = {};
              traverse(child, childObj);
              obj[node.nodeName][child.nodeName].push(childObj[child.nodeName]);
            }
          }
        }
      }
    }
    traverse(xmlDoc.documentElement, obj);
    return obj;
  } catch (e) {
    return { error: e.message };
  }
}

// XMLを整形する関数
function formatXML(xml) {
  // 改行とインデントを付加して整形する簡易フォーマッタ
  let formatted = '';
  let reg = /(>)(<)(\/*)/g;
  xml = xml.replace(reg, '$1\r\n$2$3');
  let pad = 0;
  xml.split('\r\n').forEach((node) => {
    if (node.match(/^<\/\w/)) {
      if (pad > 0) pad--;
    }
    formatted += '  '.repeat(pad) + node + '\r\n';
    if (node.match(/^<\w([^>]*[^\/])?>.*$/)) {
      pad++;
    }
  });
  return formatted;
}
