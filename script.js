let inputCount = 0;
let isNameMatched = false;
let mappingList = [];

window.onload = () => {
  addInputField('', '채팅방 1');
};

function addInputField(defaultText = '', title = '') {
  inputCount++;
  const container = document.getElementById('inputContainer');
  const card = document.createElement('div');
  card.className = 'input-card';
  card.id = `inputCard_${inputCount}`;

  const roomTitle = title ? title : `채팅방 ${inputCount}`;

  card.innerHTML = `
    <div class="input-header">
      <span id="title_${inputCount}">${roomTitle}</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <label class="btn-file">
          📁 파일 선택
          <input type="file" accept=".txt,.log,text/*" onchange="loadFile(event, 'textarea_${inputCount}', 'title_${inputCount}')" style="display:none;">
        </label>
        ${inputCount > 1 ? `<button class="btn-delete" onclick="removeInputField('inputCard_${inputCount}')">삭제</button>` : ''}
      </div>
    </div>
    <textarea style="height: 160px;" placeholder="채팅 내역을 입력하거나 파일을 선택하세요..." id="textarea_${inputCount}">${defaultText}</textarea>
  `;
  container.appendChild(card);
}

function removeInputField(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.remove();
}

function loadFile(event, textareaId, titleId) {
  const file = event.target.files[0];
  if (!file) return;

  if (titleId) {
    document.getElementById(titleId).innerText = file.name.replace('.txt', '');
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById(textareaId).value = e.target.result;
  };
  reader.readAsText(file, 'UTF-8');
}

async function loadBandFolder(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const bandTxtFiles = files.filter(f => f.name.endsWith('.txt'));

  if (bandTxtFiles.length === 0) {
    alert('선택한 폴더 내에서 텍스트(.txt) 파일을 찾을 수 없습니다.');
    return;
  }

  const roomLatestFileMap = {};

  bandTxtFiles.forEach(file => {
    const path = file.webkitRelativePath || file.name;
    const match = path.match(/BandChat_(.+?)_(\d{8}_\d{6})/i) || path.match(/(.+?)_(\d{8}_\d{6})/);

    let roomName = file.name.replace('.txt', '');
    let timestamp = '00000000_000000';

    if (match) {
      roomName = match[1];
      timestamp = match[2];
    }

    if (!roomLatestFileMap[roomName] || timestamp > roomLatestFileMap[roomName].timestamp) {
      roomLatestFileMap[roomName] = {
        file: file,
        timestamp: timestamp,
        roomName: roomName
      };
    }
  });

  document.getElementById('inputContainer').innerHTML = '';
  inputCount = 0;

  const roomEntries = Object.values(roomLatestFileMap);
  
  for (const item of roomEntries) {
    const text = await readFileAsText(item.file);
    addInputField(text, `${item.roomName} (${item.timestamp !== '00000000_000000' ? item.timestamp.split('_')[0] : '최신'})`);
  }

  alert(`총 ${roomEntries.length}개의 최신 채팅방 내역을 성공적으로 불러왔습니다!`);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = err => reject(err);
    reader.readAsText(file, 'UTF-8');
  });
}

function switchTab(tabIndex) {
  document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === tabIndex - 1);
  });
  document.querySelectorAll('.tab-content').forEach((content, idx) => {
    content.classList.toggle('active', idx === tabIndex - 1);
  });
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAllDatesInRange(minDateStr, maxDateStr) {
  const dates = [];
  let curr = new Date(minDateStr);
  const end = new Date(maxDateStr);
  while (curr <= end) {
    dates.push(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// -----------------------------------------------------------------
// 💡 캐릭터 이름 정제 및 밴드 댓글 파싱 알고리즘
// -----------------------------------------------------------------

function cleanAndExtractChar(str) {
  if (!str) return '';
  
  let target = str.trim();
  
  target = target.replace(/^캐신\s*/, '')
                 .replace(/^캐변\s*/, '')
                 .replace(/^임시\s*/, '')
                 .replace(/종료\s*$/, '')
                 .trim();

  const parts = target.split(/[,|]/);
  let lastPart = parts.pop().trim();

  lastPart = lastPart.replace(/[\s\.\!\,\.ᐟ\d\(\)\⋯]+$/g, "").trim();

  if (!lastPart) return '';

  const words = lastPart.split(/\s+/);
  if (words.length >= 2) {
    return words.slice(-2).join(" ");
  } else if (words.length === 1) {
    return words[0];
  }

  return lastPart;
}

function extractCharacterName(content) {
  if (!content || content.includes("비밀 댓글입니다")) {
    return null;
  }

  let target = content;
  if (/[->→>➣]/.test(content)) {
    target = content.split(/[->→>➣]/).pop();
  }

  return cleanAndExtractChar(target);
}

function parseBandComments(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const comments = [];

  const timeRegex = /^(\d{1,2}월\s*\d{1,2}일|\d+(?:시간|분|일)\s*전|어제)/;
  const prefixRegex = /^(리더|공동리더|멤버)(.+)$/;

  let i = 0;
  while (i < lines.length) {
    let prefix = "";
    let name = "";

    if (i + 1 < lines.length) {
      const l1 = lines[i];
      const l2 = lines[i + 1];

      const pMatch = l1.match(prefixRegex);
      if (pMatch && pMatch[2] === l2) {
        prefix = pMatch[1];
        name = l2;
      } else if (l1 === l2) {
        prefix = "";
        name = l1;
      }
    }

    if (!name) {
      i++;
      continue;
    }

    i += 2;

    const subName = (i < lines.length) ? lines[i] : "";
    i++;

    const contentLines = [];
    let time = "";

    while (i < lines.length) {
      const currentLine = lines[i];
      if (timeRegex.test(currentLine)) {
        time = currentLine;
        i++;
        break;
      }
      contentLines.push(currentLine);
      i++;
    }

    const content = contentLines.join("\n");

    let hasCommentEdit = false;
    while (i < lines.length) {
      if (i + 1 < lines.length) {
        const checkL1 = lines[i];
        const checkL2 = lines[i + 1];
        const checkPMatch = checkL1.match(prefixRegex);
        if ((checkPMatch && checkPMatch[2] === checkL2) || (checkL1 === checkL2)) {
          break;
        }
      }

      if (lines[i].includes("댓글 수정") || lines[i].includes("댓글수정")) {
        hasCommentEdit = true;
      }
      i++;
    }

    const extractedCharacter = extractCharacterName(content);

    comments.push({
      prefix,
      name,
      subName,
      content,
      time,
      hasCommentEdit,
      character: extractedCharacter
    });
  }

  return comments;
}

function parseCharacterHistory(comments) {
  const userHistoryMap = {};

  comments.forEach(c => {
    const userName = c.name;
    const content = c.content;
    const time = c.time;

    let type = null;
    if (content.includes("캐변")) type = "캐변";
    else if (content.includes("캐신")) type = "캐신";
    else if (content.includes("임시")) type = "임시";
    else if (content.includes("종료")) type = "종료";

    if (!type) return;

    if (!userHistoryMap[userName]) {
      userHistoryMap[userName] = [];
    }

    const currentHistory = userHistoryMap[userName];
    const lastEntry = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : null;

    let prevChar = lastEntry ? lastEntry.char : '';
    let char = '';

    const hasArrow = /[->→>➣]/.test(content);

    if (hasArrow) {
      const parts = content.split(/[->→>➣]/);
      const leftPart = parts[0];
      const rightPart = parts[parts.length - 1];

      const extractedPrev = cleanAndExtractChar(leftPart);
      const extractedNext = cleanAndExtractChar(rightPart);

      if (extractedPrev) prevChar = extractedPrev;
      if (extractedNext) char = extractedNext;
    } else {
      if (type === "종료") {
        let originalChar = '';
        for (let idx = currentHistory.length - 1; idx >= 0; idx--) {
          if (currentHistory[idx].type !== "임시") {
            originalChar = currentHistory[idx].char;
            break;
          }
        }
        char = originalChar || prevChar || '(원래 캐릭터)';
      } else {
        char = cleanAndExtractChar(content);
      }
    }

    userHistoryMap[userName].push({
      time,
      type,
      prevChar,
      char,
      rawContent: content
    });
  });

  return userHistoryMap;
}

function renderCharHistory(allComments) {
  const historyMap = parseCharacterHistory(allComments);
  const charHistoryList = document.getElementById('charHistoryList');
  charHistoryList.innerHTML = '';

  const users = Object.keys(historyMap);

  if (users.length === 0) {
    charHistoryList.innerHTML = `<li class="info-item">캐릭터 신청/변경 내역이 없습니다.</li>`;
    return;
  }

  users.forEach(user => {
    const history = historyMap[user];
    const lastEntry = history[history.length - 1];
    const currentChar = lastEntry ? lastEntry.char : '미정';

    let historyHtml = history.map(item => {
      let badgeStyle = 'badge-gray';
      if (item.type === '캐신') badgeStyle = 'badge-success';
      else if (item.type === '캐변') badgeStyle = 'badge-primary';
      else if (item.type === '임시') badgeStyle = 'badge-warn';
      else if (item.type === '종료') badgeStyle = 'badge-danger';

      let changeDesc = '';
      if (item.type === '캐신') {
        changeDesc = `🟢 <strong>${item.char}</strong>`;
      } else if (item.type === '캐변') {
        changeDesc = `<span>${item.prevChar || '이전'}</span> ➔ <strong>${item.char}</strong>`;
      } else if (item.type === '임시') {
        changeDesc = `<span>${item.prevChar || '원래'}</span> ➔ <strong>${item.char}</strong>`;
      } else if (item.type === '종료') {
        changeDesc = `<span>${item.prevChar || '임시'}</span> ➔ <strong>${item.char}</strong>`;
      }

      return `
        <div style="margin-top: 6px; padding: 8px 12px; background: #ffffff; border-left: 3px solid #6366f1; border-radius: 4px; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><span class="badge ${badgeStyle}">${item.type}</span> ${changeDesc}</span>
            <span style="color: #94a3b8; font-size: 0.75rem;">${item.time}</span>
          </div>
          <div style="color: #64748b; font-size: 0.78rem; white-space: pre-wrap; margin-top: 2px;">${item.rawContent}</div>
        </div>
      `;
    }).join('');

    charHistoryList.innerHTML += `
      <li class="info-item" style="flex-direction: column; align-items: stretch; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          <div>
            <strong style="font-size: 1rem;">${user}</strong>
            <span class="badge badge-warn" style="margin-left: 8px;">현재 캐릭터: ${currentChar}</span>
          </div>
          <span style="font-size: 0.8rem; color: #64748b;">총 ${history.length}회 변경/신청</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
          ${historyHtml}
        </div>
      </li>
    `;
  });
}

function getMemberCharacterMapping(comments, latestOnly = true) {
  const validComments = comments.filter(c => c.character !== null);

  if (!latestOnly) {
    return validComments.map(c => ({
      name: c.name,
      character: c.character,
      prefix: c.prefix,
      subName: c.subName,
      time: c.time,
      content: c.content,
      hasCommentEdit: c.hasCommentEdit
    }));
  }

  const map = new Map();
  for (const c of validComments) {
    map.set(c.name, {
      name: c.name,
      character: c.character,
      prefix: c.prefix,
      subName: c.subName,
      time: c.time,
      content: c.content,
      hasCommentEdit: c.hasCommentEdit
    });
  }

  return Array.from(map.values());
}

function runParser() {
  const text = document.getElementById("rawInput").value;
  if (!text.trim()) {
    alert("파싱할 밴드 댓글 텍스트를 입력해주세요.");
    return;
  }
  
  const allComments = parseBandComments(text);
  
  mappingList = getMemberCharacterMapping(allComments, true);
  isNameMatched = true;

  renderCharHistory(allComments);

  // 파싱 완료 메시지 표시
  const statusEl = document.getElementById("parseStatus");
  if (statusEl) {
    statusEl.textContent = `✅ 총 ${mappingList.length}명의 캐릭터 매핑이 완료되었습니다!`;
  }

  // 만약 이미 채팅 파일 분석 결과 탭이 열려있는 상태라면 바로 재분석 수행
  const tabsContainer = document.getElementById("tabsContainer");
  if (tabsContainer && tabsContainer.style.display !== "none") {
    analyzeAll();
  }
}

// -----------------------------------------------------------------
// 📊 전체 다중 채팅방 접속 통계 분석 함수
// -----------------------------------------------------------------

function analyzeAll() {
  const textareas = document.querySelectorAll('.input-grid textarea');
  const nConsec = parseInt(document.getElementById('consecLoginDays').value) || 2;
  const mConsec = parseInt(document.getElementById('consecAbsentDays').value) || 3;
  const kAbsence = parseInt(document.getElementById('absenceThresholdDays').value) || 5;
  const excludeToday = document.getElementById('excludeToday').checked;

  const regex = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\d{1,2}:\d{2}:\s*(.+?):\s*/g;
  
  const userDateMap = {};
  const dateUserMap = {};
  const allUsersSet = new Set();
  const allParsedDatesSet = new Set();

  textareas.forEach(ta => {
    const text = ta.value;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const y = match[1];
      const m = String(match[2]).padStart(2, '0');
      const d = String(match[3]).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const name = match[4].trim();

      allParsedDatesSet.add(dateStr);

      const matchedItem = mappingList.find(item => item.name === name);
      const displayName = (isNameMatched && matchedItem?.character) ? `${name} (${matchedItem.character})` : name;

      if (!userDateMap[displayName]) userDateMap[displayName] = new Set();
      userDateMap[displayName].add(dateStr);

      if (!dateUserMap[dateStr]) dateUserMap[dateStr] = new Set();
      dateUserMap[dateStr].add(displayName);

      allUsersSet.add(displayName);
    }
  });

  if (excludeToday) {
    const todayStr = formatDate(new Date());
    allParsedDatesSet.delete(todayStr);
  }

  if (allParsedDatesSet.size === 0) {
    alert('유효한 채팅 내역을 찾을 수 없습니다.');
    return;
  }

  const users = Array.from(allUsersSet).sort();
  const sortedParsedDates = Array.from(allParsedDatesSet).sort();
  
  const minDate = sortedParsedDates[0];
  const maxDate = sortedParsedDates[sortedParsedDates.length - 1];
  
  const datesAsc = getAllDatesInRange(minDate, maxDate);
  const datesDesc = [...datesAsc].reverse();

  const consecHighlights = {};
  const currentlyAbsentUsers = new Set();
  const consecLoginResults = [];
  const consecAbsentResults = [];

  users.forEach(user => {
    consecHighlights[user] = {};
    const userDates = userDateMap[user] || new Set();

    const userSortedDates = Array.from(userDates).sort();
    const firstLoginDate = userSortedDates[0];

    let loginStreak = [];
    datesAsc.forEach(d => {
      if (userDates.has(d)) {
        loginStreak.push(d);
      } else {
        if (loginStreak.length >= nConsec) {
          consecLoginResults.push({
            user, count: loginStreak.length,
            start: loginStreak[0], end: loginStreak[loginStreak.length - 1]
          });
          loginStreak.forEach(sd => consecHighlights[user][sd] = 'login-strong');
        }
        loginStreak = [];
      }
    });
    if (loginStreak.length >= nConsec) {
      consecLoginResults.push({
        user, count: loginStreak.length,
        start: loginStreak[0], end: loginStreak[loginStreak.length - 1]
      });
      loginStreak.forEach(sd => consecHighlights[user][sd] = 'login-strong');
    }

    let nonLoginStreak = [];
    datesAsc.forEach(d => {
      if (firstLoginDate && d < firstLoginDate) {
        return;
      }
      if (!userDates.has(d)) {
        nonLoginStreak.push(d);
      } else {
        processNonLogin(user, nonLoginStreak);
        nonLoginStreak = [];
      }
    });
    processNonLogin(user, nonLoginStreak);

    function processNonLogin(u, streak) {
      const len = streak.length;
      if (len >= mConsec) {
        const isAbsenceK = len >= kAbsence;
        consecAbsentResults.push({
          user: u,
          count: len,
          start: streak[0],
          end: streak[streak.length - 1],
          isK: isAbsenceK
        });

        streak.forEach(sd => {
          consecHighlights[u][sd] = isAbsenceK ? 'absence-k' : 'absent-m';
        });
      }
    }

    if (!userDates.has(maxDate)) {
      let currentStreak = 0;
      for (let i = datesAsc.length - 1; i >= 0; i--) {
        if (!userDates.has(datesAsc[i])) {
          currentStreak++;
        } else {
          break;
        }
      }
      if (currentStreak >= kAbsence) {
        currentlyAbsentUsers.add(user);
      }
    }
  });

  consecLoginResults.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  consecAbsentResults.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));

  const normalUsers = users.filter(u => !currentlyAbsentUsers.has(u)).sort();
  const absentUsers = users.filter(u => currentlyAbsentUsers.has(u)).sort();
  const timelineUsers = [...normalUsers, ...absentUsers];

  document.getElementById('tabsContainer').style.display = 'block';

  // (1) 타임라인
  const headerTr = document.getElementById('timelineHeader');
  headerTr.innerHTML = `<th>날짜 (Y) \\ 인원 (X)</th>` + timelineUsers.map(u => {
  const isAbsentNow = currentlyAbsentUsers.has(u);
  const timelineUserLabel = u.replace(' (', '<br>(');
  return `<th class="${isAbsentNow ? 'th-absent-user' : ''}">
      ${timelineUserLabel}${isAbsentNow ? '<br><span class="badge-absent-header">부재중</span>' : ''}
    </th>`;
  }).join('');

  const bodyTbody = document.getElementById('timelineBody');
  bodyTbody.innerHTML = '';

  datesDesc.forEach(dateStr => {
    const tr = document.createElement('tr');
    let rowHtml = `<td><strong>${dateStr}</strong></td>`;

    timelineUsers.forEach(user => {
      const isLogged = userDateMap[user] && userDateMap[user].has(dateStr);
      const highlight = consecHighlights[user]?.[dateStr];

      // 유저의 첫 접속일 구하기
      const uSorted = Array.from(userDateMap[user] || []).sort();
      const firstDate = uSorted[0];

      let cellClass = 'cell-absent-normal';
      let symbol = 'X';

      // 첫 접속일 이전이면 X 대신 - 로 표시
      if (firstDate && dateStr < firstDate) {
        cellClass = 'cell-before-join'; // 필요시 CSS 추가
        symbol = '-';
      } else if (isLogged) {
        if (highlight === 'login-strong') {
          cellClass = 'cell-login-strong';
          symbol = 'O';
        } else {
          cellClass = 'cell-login-normal';
          symbol = 'O';
        }
      } else {
        if (highlight === 'absence-k') {
          cellClass = 'cell-absence-k';
          symbol = 'X';
        } else if (highlight === 'absent-m') {
          cellClass = 'cell-absent-m';
          symbol = 'X';
        }
      }

      rowHtml += `<td class="${cellClass}">${symbol}</td>`;
    });

    tr.innerHTML = rowHtml;
    bodyTbody.appendChild(tr);
  });

  // (2) 인원별 접속 날짜
  const userDatesList = document.getElementById('userDatesList');
  userDatesList.innerHTML = '';
  users.forEach(user => {
    const dates = Array.from(userDateMap[user] || []).filter(d => !excludeToday || d !== formatDate(new Date())).sort().reverse();
    const isAbsentNow = currentlyAbsentUsers.has(user);
    userDatesList.innerHTML += `
      <li class="info-item">
        <div>
          <strong style="white-space: nowrap;">${user}</strong> ${isAbsentNow ? '<span class="badge badge-gray">현재 부재중</span>' : ''}
          <span class="badge badge-warn">총 ${dates.length}일 접속</span>
        </div>
        <div style="font-size:0.85rem; color:#475569;">${dates.join(', ')}</div>
      </li>`;
  });

  // (3) 날짜별 접속 인원
  const dateUsersList = document.getElementById('dateUsersList');
    dateUsersList.innerHTML = '';
    datesDesc.forEach(dateStr => {
    const activeUsers = Array.from(dateUserMap[dateStr] || []).sort();
    dateUsersList.innerHTML += `
      <li class="info-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <div style="display: flex; gap: 8px; align-items: center; width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            <strong>${dateStr}</strong> 
            <span class="badge badge-warn">참여 ${activeUsers.length}명</span>
        </div>
        <div style="width: 100%; line-height: 1.6; word-break: keep-all; color: #334155;">
            ${activeUsers.length > 0 ? activeUsers.join(', ') : '<span style="color:#94a3b8;">접속자 없음</span>'}
        </div>
      </li>`;
  });

  // (4) 연속 접속 인원
  const consecLoginList = document.getElementById('consecLoginList');
  consecLoginList.innerHTML = '';
  if (consecLoginResults.length === 0) {
    consecLoginList.innerHTML = `<li class="info-item">${nConsec}일 이상 연속 접속한 인원이 없습니다.</li>`;
  } else {
    consecLoginResults.forEach(r => {
      consecLoginList.innerHTML += `
        <li class="info-item">
          <div>
            <strong style="white-space: nowrap;">${r.user}</strong>
            <span class="badge badge-success">${nConsec}일 이상 연속 접속</span>
          </div>
          <div>${r.start} ~ ${r.end} (총 ${r.count}일간)</div>
        </li>`;
    });
  }

  // (5) 연속 미접속/부재 인원
  const consecAbsentList = document.getElementById('consecAbsentList');
  consecAbsentList.innerHTML = '';
  if (consecAbsentResults.length === 0) {
    consecAbsentList.innerHTML = `<li class="info-item">${mConsec}일 이상 연속 미접속 또는 부재 인원이 없습니다.</li>`;
  } else {
    consecAbsentResults.forEach(r => {
      const badgeClass = r.isK ? 'badge-gray' : 'badge-danger';
      const labelText = r.isK ? `부재 (${kAbsence}일 이상 미접속)` : `${mConsec}일 이상 연속 미접속`;
      consecAbsentList.innerHTML += `
        <li class="info-item">
          <div>
            <strong style="white-space: nowrap;">${r.user}</strong>
            <span class="badge ${badgeClass}">${labelText}</span>
          </div>
          <div>${r.start} ~ ${r.end} (총 ${r.count}일간)</div>
        </li>`;
    });
  }
}