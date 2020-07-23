import {Route} from './routes/Route.js';
import {DropDownMenu} from './DropDown.js';

export class Utils {

  // functions for URL parameters

  static _getQueryParam2(pUrl, pName) {
    const questionmarkPos = pUrl.indexOf("?");
    if(questionmarkPos < 0) return undefined;
    const parameters = pUrl.slice(questionmarkPos + 1).split("&");
    for(const parameter of parameters) {
      const namevalue = parameter.split("=");
      if(namevalue.length !== 2) continue;
      if(namevalue[0] === pName) return namevalue[1];
    }
    return undefined;
  }

  /* istanbul ignore next */
  static getQueryParam(pName) {
    let w = null;
    try { w = window; } catch(error) { /* VOID */ }
    if(!w || !w.location) return undefined;
    return Utils._getQueryParam2(w.location.href, pName);
  }

  // functions for storage handling

  static _getStorage(pStorage) {
    // "window" is not defined during unit testing
    try { const w = window; } catch(error) { return null; }
    if(pStorage === "local") return window.localStorage;
    if(pStorage === "session") return window.sessionStorage;
    console.error("UNKNOWN STORAGE TYPE", pStorage);
    return null;
  }

  static getStorageItem(pStorage, pKeyName, pDefaultValue=null) {
    const storage = Utils._getStorage(pStorage);
    if(!storage) { console.log("getStorageItem", pStorage, pKeyName); return pDefaultValue; }
    const v = storage.getItem(pKeyName);
    //console.log("getStorageItem", pStorage, pKeyName, pDefaultValue, "-->", typeof v, v);
    if(v === null) return pDefaultValue;
    if(v === "undefined") return pDefaultValue;
    return v;
  }

  static setStorageItem(pStorage, pKeyName, pValue) {
    const storage = Utils._getStorage(pStorage);
    if(!storage) { console.log("setStorageItem", pStorage, pKeyName, pValue); return; }
    //console.log("setStorageItem", pStorage, pKeyName, pValue);
    storage.setItem(pKeyName, pValue);
  }

  static clearStorage(pStorage) {
    const storage = Utils._getStorage(pStorage);
    if(!storage) { console.log("clearStorage", pStorage); return; }
    //console.log("clearStorage", pStorage);
    storage.clear();
  }

  // other functions

  static addToolTip(pTooltipHost, pTooltipText, pStyle="bottom-center") {

    // Users may want to switch this on to improve browser performance
    const toolTipMode = Utils.getStorageItem("session", "tooltip_mode");

    if(toolTipMode === "none") {
      return;
    }

    if(toolTipMode === "simple") {
      pTooltipHost.setAttribute("title", pTooltipText);
      return;
    }

    // null or "full" (or anything else)
    const tooltipSpan = Route.createSpan("", pTooltipText);
    tooltipSpan.classList.add("tooltip-text");
    tooltipSpan.classList.add("tooltip-text-" + pStyle);
    pTooltipHost.classList.add("tooltip");

    // remove the old tooltip...
    for(let i = pTooltipHost.children.length - 1; i >= 0; i--) {
      const child = pTooltipHost.children[i];
      if(child.classList.contains("tooltip-text")) {
        pTooltipHost.removeChild(child);
      }
    }

    // ...then add the new tooltip
    pTooltipHost.appendChild(tooltipSpan);
  }

  static makeTableSortable(pStartElement, pIsReverseSort=false, pColumnNr=0) {
    const thArr = Array.prototype.slice.call(pStartElement.querySelectorAll("table th"));
    // we do not expect any rows in the table at this moment
    // but sorting is applied to show the sorting indicator
    sorttable.innerSortFunction.apply(thArr[pColumnNr], []);
    if(pIsReverseSort) sorttable.innerSortFunction.apply(thArr[pColumnNr], []);
    for(const th of thArr) {
      if(th.classList.contains("sorttable_nosort")) continue;
      // the tooltip is too bulky to use, skip for now
      //Utils.addToolTip(th, "Click to sort");
    }
  }

  static addErrorToTableCell(pTd, pErrorMessage) {
    const span = Route.createSpan("", "(error)");
    Utils.addToolTip(span, pErrorMessage, "bottom-left");
    pTd.appendChild(span);
  }

  static hasTextContent(pElement, pSearchText, pCaseSensitiveFlag) {

    // why?
    if(pElement.classList && pElement.classList.contains("run-command-button"))
      return false;

    let found = false;
    for(const childNode of pElement.childNodes) {
      const r = this.hasTextContent(childNode, pSearchText, pCaseSensitiveFlag);
      if(r == 2) return 2;
      if(r == 1) found = true;
    }
    if(found) return 1;

    if(pElement.nodeType !== 3) // NODE_TEXT
      return 0;

    let s = pElement.textContent;
    if(typeof pSearchText == "string") {
      if(!pCaseSensitiveFlag) s = s.toUpperCase();
      return s.includes(pSearchText) ? 1 : 0;
    } else {
      // then it is a RegExp
      const regs = pSearchText.exec(s);
      if(!regs) return 0;
      return regs[0].length > 0 ? 1 : 2;
    }
  }

  static makeTableSearchable(pStartElement, pButtonId, pTableId, pFieldList=null) {

    const div = Route.createDiv("search-box", "");
    div.style.display = "none";

    const menuAndFieldDiv = Route.createDiv("search-menu-and-field", "");

    const searchOptionsMenu = new DropDownMenu(menuAndFieldDiv);

    const input = document.createElement("input");
    input.classList.add("filter-text");
    // 1F50D = D83D DD0D = LEFT-POINTING MAGNIFYING GLASS
    input.placeholder = "\uD83D\uDD0D";
    if(pFieldList) input.setAttribute("list", pFieldList);
    menuAndFieldDiv.append(input);

    div.append(menuAndFieldDiv);

    const errorDiv = Route.createDiv("search-error", "");
    errorDiv.style.display = "none";
    div.append(errorDiv);

    const table = document.getElementById(pTableId);
    table.parentElement.insertBefore(div, table);

    table.parentElement.insertBefore(div, table);

    searchOptionsMenu.addMenuItem(
      "Case sensitive",
      ev => Utils._updateSearchOption(ev, table, searchOptionsMenu, input));
    searchOptionsMenu.addMenuItem(
      "Regular expression",
      ev => Utils._updateSearchOption(ev, table, searchOptionsMenu, input));
    searchOptionsMenu.addMenuItem(
      "Invert search",
      ev => Utils._updateSearchOption(ev, table, searchOptionsMenu, input));

    // make the search function active
    const searchButton = document.getElementById(pButtonId);
    searchButton.onclick = ev =>
      Utils.hideShowTableSearchBar(div, table);
  }

  static _updateSearchOption(ev, pTable, pSearchOptionsMenu, pInput) {
    ev.target._value = !ev.target._value;

    let t = ev.target.innerText;
    t = t.replace(/^. /, "");
    // 2714 = HEAVY CHECK MARK
    if(ev.target._value === true) t = "\u2714 " + t;
    ev.target.innerText = t;

    Utils._updateTableFilter(
      pTable,
      pInput.value,
      pSearchOptionsMenu.menuDropdownContent);

    // D83D DD0D = 1F50D = LEFT-POINTING MAGNIFYING GLASS
    let placeholder = "\uD83D\uDD0D";
    if(pSearchOptionsMenu.menuDropdownContent.childNodes[0]._value === true)
      placeholder += " caseSensitive";
    if(pSearchOptionsMenu.menuDropdownContent.childNodes[1]._value === true)
      placeholder += " regExp";
    if(pSearchOptionsMenu.menuDropdownContent.childNodes[2]._value === true)
      placeholder += " invertSearch";
    pInput.placeholder = placeholder;
  }

  static addTableHelp(pStartElement, pHelpText, pStyle="bottom-right") {
    const helpButton = pStartElement.querySelector("#help");
    helpButton.classList.add("search-button");
    Utils.addToolTip(helpButton, pHelpText, pStyle);
  }

  static hideShowTableSearchBar(pSearchBlock, pTable, pAction="toggle") {
    const startElement = pTable.parentElement;

    // remove all highlights
    const searchInSelector = pTable.tagName === "TABLE" ? "tbody" : "";
    const hilitor = new Hilitor(pTable, searchInSelector);
    hilitor.remove();

    // show rows in all tables
    const allFM = pTable.querySelectorAll(".no-filter-match");
    for(const fm of allFM)
      fm.classList.remove("no-filter-match");

    const menuItems = startElement.querySelector(".search-box .menu-dropdown-content");

    // hide/show search box (the block may become more complicated later)
    const input = pSearchBlock.querySelector("input");
    input.onkeyup = ev => {
      if(ev.key === "Escape") {
        Utils._updateTableFilter(pTable, "", menuItems);
        Utils.hideShowTableSearchBar(pSearchBlock, pTable);
        return;
      }
    };
    input.oninput = ev =>
      Utils._updateTableFilter(pTable, input.value, menuItems);

    pTable.parentElement.insertBefore(pSearchBlock, pTable);
    if(pAction === "refresh" && pSearchBlock.style.display === "none") {
      Utils._updateTableFilter(pTable, "", menuItems);
    } else if(pAction === "refresh") {
      Utils._updateTableFilter(pTable, input.value, menuItems);
    } else if(pSearchBlock.style.display === "none") {
      Utils._updateTableFilter(pTable, input.value, menuItems);
      pSearchBlock.style.display = "";
    } else {
      Utils._updateTableFilter(pTable, "", menuItems);
      pSearchBlock.style.display = "none";
    }
    input.focus();
  }

  static _updateTableFilter(pTable, pSearchText, pMenuItems) {
    // remove highlighting before re-comparing
    // as it affects the texts
    const searchInSelector = pTable.tagName === "TABLE" ? "tbody" : "";
    const hilitor = new Hilitor(pTable, searchInSelector);
    hilitor.remove();

    // values may be undefined, so convert to proper boolean
    const caseSensitiveFlag = pMenuItems.childNodes[0]._value === true;
    const regExpFlag = pMenuItems.childNodes[1]._value === true;
    let invertFlag = pMenuItems.childNodes[2]._value === true;

    // otherwise everything is immediatelly hidden
    if(invertFlag && !pSearchText) {
      invertFlag = false;
    }

    // find text
    if(!caseSensitiveFlag && !regExpFlag) {
      pSearchText = pSearchText.toUpperCase();
    }

    let regexp = undefined;

    const errorBox = pTable.parentElement.querySelector(".search-error");
    if(regExpFlag) {
      try {
        regexp = new RegExp(pSearchText, caseSensitiveFlag ? "" : "i");
      } catch(err) {
        errorBox.innerText = err.message;
        errorBox.style.display = "";
        return;
      }
    }
    errorBox.style.display = "none";

    const searchParam = regExpFlag ? regexp : pSearchText;
    let hasEmptyMatches = false;
    let hasNonEmptyMatches = false;
    const blocks = pTable.tagName === "TABLE" ? pTable.tBodies[0].rows : pTable.children;
    for(const row of blocks) {
      if(row.classList.contains("no-search")) continue;
      let show = false;
      const items = row.tagName === "TR" ? row.cells : [row];
      for(const cell of items) {
        // do not use "innerText"
        // that one does not handle hidden text
        const res = Utils.hasTextContent(cell, searchParam, caseSensitiveFlag);
        if(res === 1) hasNonEmptyMatches = true;
        if(res === 2) hasEmptyMatches = true;
        // don't exit the loop, there might also be empty matches
        if(res) show = true;
      }
      if(invertFlag) show = !show;
      if(show)
        row.classList.remove("no-filter-match");
      else
        row.classList.add("no-filter-match");
    }
    if(pSearchText && hasEmptyMatches) {
      const indicator = hasNonEmptyMatches ? "also" : "only";
      errorBox.innerText = "warning: there were " + indicator + " empty matches, highlighting is not performed";
      errorBox.style.display = "";
      return;
    }

    // show the result
    hilitor.setMatchType("open");
    hilitor.setEndRegExp(/^$/);
    hilitor.setBreakRegExp(/^$/);

    let pattern;
    if(regExpFlag) {
      pattern = pSearchText;
    } else {
      // turn the text into a regexp
      pattern = "";
      for(const chr of pSearchText) {
        // prevent accidental construction of character classes
        if((chr >= 'A' && chr <= 'Z') || (chr >= 'a' && chr <= 'z') || (chr >= '0' && chr <= '9'))
          pattern += chr;
        else
          pattern += "\\" + chr;
      }
    }

    hilitor.apply(pattern, caseSensitiveFlag);
  }

  static txtZeroOneMany(pCnt, pZeroText, pOneText, pManyText) {
    let txt = pManyText;
    if(pCnt === 0) txt = pZeroText;
    if(pCnt === 1) txt = pOneText;
    txt = txt.replace("{0}", pCnt);
    return txt;
  }

  // MinionIds cannot directly be used as IDs for HTML elements
  // the id may contain characters that are not allowed in an ID
  // btoa is the base64 encoder
  static getIdFromMinionId(pMinionId) {
    const patEqualSigns = /==*/;
    return "m" + btoa(pMinionId).replace(patEqualSigns, "");
  }

  // JobIds are in the format 20190529175411210984
  // so just adding a prefix is sufficient
  static getIdFromJobId(pJobId) {
    return "j" + pJobId;
  }

  static isMultiLineString(pStr) {
    if(pStr.includes("\r")) return true;
    if(pStr.includes("\n")) return true;
    return false;
  }

  static createJobStatusSpan(pJobId) {
    const span = Route.createSpan("", "");
    // 21BB = CLOCKWISE OPEN CIRCLE ARROW
    span.innerHTML = "&#x21BB;&nbsp;";
    span.id = "status" + pJobId;
    span.style.display = "none";
    span.style.fontWeight = "bold";
    return span;
  }
}
