/* global document */

import {Character} from "../Character.js";
import {DropDownMenu} from "../DropDown.js";
import {Output} from "../output/Output.js";
import {Panel} from "./Panel.js";
import {ParseCommandLine} from "../ParseCommandLine.js";
import {TargetType} from "../TargetType.js";
import {Utils} from "../Utils.js";

export class JobPanel extends Panel {

  constructor () {
    super("job");

    this.addTitle("... on ...");
    this.addCloseButton();
    this.addPanelMenu();
    this.addSearchButton();

    // 1: re-run with original target pattern
    this._addPanelMenuItemJobRerunJob();

    // 2: re-run list of minions
    this._addPanelMenuItemRerunJobOnAllMinionsWhenNeeded();

    // 3: re-run all failed (error+timeout)
    this._addPanelMenuItemRerunJobOnUnsuccessfulMinionsWhenNeeded();

    // 4: re-run all failed (error)
    this._addPanelMenuItemRerunJobOnFailedMinionsWhenNeeded();

    // 5: re-run all failed (timeout)
    this._addPanelMenuItemRerunJobOnNonRespondingMinionsWhenNeeded();

    // 6: kill with original target pattern
    this._addPanelMenuItemTerminateJob();
    this._addPanelMenuItemKillJob();
    this._addPanelMenuItemSignalJob();

    const timeH2 = document.createElement("h2");
    const timeSpan = document.createElement("span");
    timeSpan.classList.add("time");
    timeH2.appendChild(timeSpan);
    this.div.append(timeH2);
    this.timeField = timeSpan;

    const warning = document.createElement("h2");
    warning.classList.add("warning");
    this.div.append(warning);
    this.warningField = warning;

    const output = document.createElement("pre");
    output.id = "job-table";
    output.classList.add("output");
    this.output = output;

    const searchBox = Utils.makeSearchBox(this.searchButton, this.output, "data-list-job");
    this.div.appendChild(searchBox);

    this.div.append(this.output);
  }

  onShow () {
    const jobId = decodeURIComponent(Utils.getQueryParam("id"));
    const minionId = decodeURIComponent(Utils.getQueryParam("minionid"));

    this.jobIsTerminated = undefined;

    const runnerJobsListJobPromise = this.api.getRunnerJobsListJob(jobId);
    const runnerJobsActivePromise = this.api.getRunnerJobsActive();

    runnerJobsListJobPromise.then((pRunnerJobsListJobData) => {
      this._handleJobRunnerJobsListJob(pRunnerJobsListJobData, jobId, minionId);
      runnerJobsActivePromise.then((pRunnerJobsActiveData) => {
        this._handleRunnerJobsActive(jobId, pRunnerJobsActiveData);
        return true;
      }, (pRunnerJobsActiveMsg) => {
        this._handleRunnerJobsActive(jobId, JSON.stringify(pRunnerJobsActiveMsg));
        return false;
      });
      return true;
    }, (pRunnerJobsListJobsMsg) => {
      this._handleJobRunnerJobsListJob(JSON.stringify(pRunnerJobsListJobsMsg), jobId, undefined);
      Utils.ignorePromise(runnerJobsActivePromise);
      return false;
    });
  }

  static _isResultOk (result) {
    if (!result.success) {
      return false;
    }
    if (result.retcode !== 0) {
      return false;
    }
    return true;
  }

  static decodeArgumentsObj (pObj) {
    if (typeof pObj !== "string") {
      return JSON.stringify(pObj);
    }
    if (ParseCommandLine.getPatJid().test(pObj)) {
      // prevent quotes being added on JIDs
      return pObj;
    }
    if (pObj.match(/^[a-z_][a-z0-9_]*(?:[.][a-z0-9_]+)*$/i)) {
      // simple string that cannot be confused with
      // another object type
      return pObj;
    }
    return JSON.stringify(pObj);
  }

  static decodeArgumentsArray (rawArguments) {

    if (rawArguments === undefined) {
      // no arguments
      return "";
    }

    if (typeof rawArguments !== "object") {
      // expecting an array (which is an object)
      // just return the representation of anything else
      return " " + JobPanel.decodeArgumentsObj(rawArguments);
    }

    if (!Array.isArray(rawArguments)) {
      // expecting an array
      // just return the representation of anything else
      return " " + JobPanel.decodeArgumentsObj(rawArguments);
    }

    let ret = "";
    for (const obj of rawArguments) {
      // all KWARGS are one entry in the parameters array
      if (obj && typeof obj === "object" && "__kwarg__" in obj) {
        const keys = Object.keys(obj).sort();
        for (const key of keys) {
          if (key === "__kwarg__") {
            continue;
          }
          ret += " " + key + "=" + JobPanel.decodeArgumentsObj(obj[key]);
        }
      } else {
        ret += " " + JobPanel.decodeArgumentsObj(obj);
      }
    }

    return ret;
  }

  static _getPatEmbeddedJid () {
    return /\b[2-9][0-9][0-9][0-9][01][0-9][0-3][0-9][0-2][0-9][0-5][0-9][0-5][0-9][0-9][0-9][0-9][0-9][0-9][0-9]\b/g;
  }

  _handleJobRunnerJobsListJob (pRunnerJobsListJobData, pJobId, pMinionId) {
    if (!pRunnerJobsListJobData) {
      return;
    }

    if (typeof pRunnerJobsListJobData !== "object") {
      this.output.innerText = "";
      Utils.addErrorToTableCell(this.output, pRunnerJobsListJobData, "bottom-left");
      this.updateTitle("ERROR");
      return;
    }

    const info = pRunnerJobsListJobData.return[0];

    if (typeof info !== "object") {
      this.updateTitle("ERROR");
      this.output.innerText = pJobId + "\n--------------------\n" + info;
      this.timeField.innerText = "";
      return;
    }
    if (info.Error) {
      this.updateTitle("ERROR");
      this.output.innerText = pJobId + "\n--------------------\n" + info.Error;
      Output.dateTimeStr(info.StartTime, this.timeField, "bottom-left");
      return;
    }

    this.output.innerText = "";

    // use same formatter as direct commands
    const argumentsText = JobPanel.decodeArgumentsArray(info.Arguments);
    const commandText = info.Function + argumentsText;

    this.targettype = info["Target-type"];
    if (Array.isArray(info.Target)) {
      this.target = info.Target.join(",");
    } else {
      this.target = info.Target;
    }
    this.commandtext = commandText;
    this.jobid = pJobId;
    this.minions = info.Minions;
    this.result = info.Result;

    // the panel menu may have been hidden
    this.panelMenu.verifyAll();

    // ============================

    const functionText = commandText + " on " +
      TargetType.makeTargetText(info);
    this.updateTitle(functionText);

    Output.dateTimeStr(info.StartTime, this.timeField, "bottom-left");

    let minions = ["WHEEL"];
    if (info.Minions) {
      minions = info.Minions;
      this.warningField.innerText = "";
    } else if (info.Function.startsWith("wheel.")) {
      minions = ["WHEEL"];
      this.warningField.innerText = Character.INFORMATION_SIGN + Character.NO_BREAK_SPACE + "WHEEL jobs are not associated with minions";
    } else if (info.Function.startsWith("runners.")) {
      minions = ["RUNNER"];
      this.warningField.innerText = Character.INFORMATION_SIGN + Character.NO_BREAK_SPACE + "RUNNER jobs are not associated with minions";
    } else {
      minions = Object.keys(this.result);
      this.warningField.innerText = Character.WARNING_SIGN + Character.NO_BREAK_SPACE + "minion list is missing in the result, thus cannot determine missing output";
    }
    let initialStatus;
    if (info.Minions === undefined || Object.keys(info.Result).length >= info.Minions.length) {
      // we have all the results
      // that means we are done
      // don't wait for RunnerJobsActive to also tell us that we are done
      // RunnerJobsActive remains running and will overwrite with the same
      initialStatus = "done";
      this.jobIsTerminated = true;
    } else {
      initialStatus = "(loading)";
      this.jobIsTerminated = false;
    }
    Output.addResponseOutput(this.output, pJobId, minions, info.Result, info.Function, initialStatus, pMinionId);

    // replace any jobid
    // Don't do this with output.innerHTML as there are already
    // event handlers in place, which then will be removed
    const patJid = JobPanel._getPatEmbeddedJid();
    const elements = this.output.querySelectorAll(".minion-output");
    for (const element of elements) {
      let html = element.innerHTML;
      html = html.replace(patJid, "<a class='linkjid' id='linkjid$&'>$&</a>");
      element.innerHTML = html;
    }

    const links = this.output.querySelectorAll(".linkjid");
    for (const link of links) {
      const linkToJid = link.id.replace("linkjid", "");

      if (linkToJid === pJobId) {
        link.classList.add("disabled");
        Utils.addToolTip(link, "this job");
      } else {
        link.addEventListener("click", (pClickEvent) => {
          this.router.goTo("job", {"id": linkToJid});
          pClickEvent.stopPropagation();
        });
      }

      // no longer needed
      link.removeAttribute("id");
      link.classList.remove("linkjid");
      if (!link.classList.length) {
        link.removeAttribute("class");
      }
    }
  }

  _addPanelMenuItemJobRerunJob () {
    this.panelMenu.addMenuItem(() => {
      if (!this.target && !this.commandtext) {
        return null;
      }
      return "Re-run job...";
    }, () => {
      this.runCommand(this.targettype, this.target, this.commandtext);
    });
  }

  _listForRerunJobOnAllMinions () {
    if (!this.minions) {
      return null;
    }

    let minionList = "";
    for (const minionId of this.minions) {
      minionList += "," + minionId;
    }

    // suppress an empty list
    if (!minionList) {
      return null;
    }

    // suppress a trivial case
    if (minionList === "," + this.minions[0]) {
      return null;
    }

    return minionList.substring(1);
  }

  _addPanelMenuItemRerunJobOnAllMinionsWhenNeeded () {
    this.panelMenu.addMenuItem(() => {
      const lst = this._listForRerunJobOnAllMinions();
      if (!lst) {
        return null;
      }
      return "Re-run job on all minions...";
    }, () => {
      const lst = this._listForRerunJobOnAllMinions();
      this.runCommand("list", lst, this.commandtext);
    });
  }

  _listForRerunJobOnUnsuccessfulMinions () {
    if (!this.minions) {
      return null;
    }

    let minionList = "";
    let has1 = false;
    let has2 = false;
    for (const minionId of this.minions) {
      if (!(minionId in this.result)) {
        has1 = true;
      }
      if (minionId in this.result && !JobPanel._isResultOk(this.result[minionId])) {
        has2 = true;
      }
      if (!(minionId in this.result) || !JobPanel._isResultOk(this.result[minionId])) {
        minionList += "," + minionId;
      }
    }

    // suppress an empty list
    if (!minionList) {
      return null;
    }

    // only when we have both types in the list
    // otherwise the #4 or #5 is sufficient
    if (!has1 || !has2) {
      return null;
    }

    return minionList.substring(1);
  }

  _addPanelMenuItemRerunJobOnUnsuccessfulMinionsWhenNeeded () {
    this.panelMenu.addMenuItem(() => {
      const lst = this._listForRerunJobOnUnsuccessfulMinions();
      if (!lst) {
        return null;
      }
      return "Re-run job on unsuccessful minions...";
    }, () => {
      const lst = this._listForRerunJobOnUnsuccessfulMinions();
      this.runCommand("list", lst, this.commandtext);
    });
  }

  _listForRerunJobOnFailedMinions () {
    if (!this.minions) {
      return null;
    }

    let minionList = "";
    for (const minionId of this.minions) {
      if (minionId in this.result && !JobPanel._isResultOk(this.result[minionId])) {
        minionList += "," + minionId;
      }
    }

    // suppress an empty list
    if (!minionList) {
      return null;
    }

    return minionList.substring(1);
  }

  _addPanelMenuItemRerunJobOnFailedMinionsWhenNeeded () {
    this.panelMenu.addMenuItem(() => {
      const lst = this._listForRerunJobOnFailedMinions();
      if (!lst) {
        return null;
      }
      return "Re-run job on failed minions...";
    }, () => {
      const lst = this._listForRerunJobOnFailedMinions();
      this.runCommand("list", lst, this.commandtext);
    });
  }

  _listForRerunJobOnNonRespondingMinions () {
    if (!this.minions) {
      return null;
    }

    let minionList = "";
    for (const minionId of this.minions) {
      if (!(minionId in this.result)) {
        minionList += "," + minionId;
      }
    }

    // suppress an empty list
    if (!minionList) {
      return null;
    }

    return minionList.substring(1);
  }

  _addPanelMenuItemRerunJobOnNonRespondingMinionsWhenNeeded () {
    this.panelMenu.addMenuItem(() => {
      const lst = this._listForRerunJobOnNonRespondingMinions();
      if (!lst) {
        return null;
      }
      return "Re-run job on non responding minions...";
    }, () => {
      const lst = this._listForRerunJobOnNonRespondingMinions();
      this.runCommand("list", lst, this.commandtext);
    });
  }

  _addPanelMenuItemTerminateJob () {
    this.panelMenu.addMenuItem(() => {
      if (this.jobIsTerminated !== false) {
        return null;
      }
      return "Terminate job...";
    }, () => {
      const cmdArr = ["saltutil.term_job", this.jobid];
      this.runCommand(this.targettype, this.target, cmdArr);
    });
  }

  _addPanelMenuItemKillJob () {
    this.panelMenu.addMenuItem(() => {
      if (this.jobIsTerminated !== false) {
        return null;
      }
      return "Kill job...";
    }, () => {
      const cmdArr = ["saltutil.kill_job", this.jobid];
      this.runCommand(this.targettype, this.target, cmdArr);
    });
  }

  _addPanelMenuItemSignalJob () {
    this.panelMenu.addMenuItem(() => {
      if (this.jobIsTerminated !== false) {
        return null;
      }
      return "Signal job...";
    }, () => {
      const cmdArr = ["saltutil.signal_job", this.jobid, "signal=", "<signalnumber>"];
      this.runCommand(this.targettype, this.target, cmdArr);
    });
  }

  _handleRunnerJobsActive (pJobId, pData) {
    const summaryJobsActiveSpan = document.getElementById("summary-jobs-active");
    if (!summaryJobsActiveSpan) {
      return;
    }

    if (typeof pData !== "object") {
      summaryJobsActiveSpan.innerText = "(error)";
      Utils.addToolTip(summaryJobsActiveSpan, pData, "bottom-left");
      return;
    }

    const info = pData.return[0][pJobId];

    // when the job is already completely done, nothing is returned
    if (!info) {
      summaryJobsActiveSpan.innerText = "done";
      this.jobIsTerminated = true;
      return;
    }
    this.jobIsTerminated = false;

    summaryJobsActiveSpan.innerText = info.Running.length + " active";
    summaryJobsActiveSpan.insertBefore(Utils.createJobStatusSpan(pJobId, true), summaryJobsActiveSpan.firstChild);
    summaryJobsActiveSpan.addEventListener("click", (pClickEvent) => {
      this.output.innerText = "loading...";
      this.onShow();
      this.panelMenu.verifyAll();
      pClickEvent.stopPropagation();
    });
    summaryJobsActiveSpan.style.cursor = "pointer";
    Utils.addToolTip(summaryJobsActiveSpan, "Click to refresh", "bottom-left");

    // update the minion details
    for (const minionInfo of info.Running) {
      // each minionInfo is like {'minion': pid}
      for (const minionId in minionInfo) {
        const pid = minionInfo[minionId];
        const noResponseSpan = this.div.querySelector("pre.output div#" + Utils.getIdFromMinionId(minionId) + " span.noresponse");
        if (!noResponseSpan) {
          continue;
        }

        // show that this minion is still active on the request
        noResponseSpan.innerText = "(active) ";

        const menu = new DropDownMenu(noResponseSpan, true);
        menu.addMenuItem("Show process info...", () => {
          const cmdArr = ["ps.proc_info", pid];
          this.runCommand("", minionId, cmdArr);
        });
        menu.addMenuItem("Terminate process...", () => {
          const cmdArr = ["ps.kill_pid", pid, "signal=", 15];
          this.runCommand("", minionId, cmdArr);
        });
        menu.addMenuItem("Kill process...", () => {
          const cmdArr = ["ps.kill_pid", pid, "signal=", 9];
          this.runCommand("", minionId, cmdArr);
        });
        menu.addMenuItem("Signal process...", () => {
          const cmdArr = ["ps.kill_pid", pid, "signal=", "<signalnumber>"];
          this.runCommand("", minionId, cmdArr);
        });

        noResponseSpan.classList.remove("noresponse");
        noResponseSpan.classList.add("active");
      }
    }
  }

  handleSaltJobRetEvent (pData) {

    // ignore the most common events until someone complains
    if (pData.fun === "saltutil.find_job") {
      return;
    }
    if (pData.fun === "saltutil.running") {
      return;
    }

    // { fun_args: […], jid: "20190704194624366796", return: true, retcode: 0, success: true, cmd: "_return", fun: "test.rand_sleep", id: "autobuild-it-4092", _stamp: "2019-07-04T17:46:28.448689" }
    const jid = pData.jid;
    if (!jid) {
      return;
    }

    let newLevel = 0;
    if (pData.success === true && pData.retcode === 0) {
      newLevel = 1;
    } else if (pData.success === true) {
      newLevel = 2;
    } else {
      newLevel = 3;
    }

    // This element only exists when the user happens to look at the output of that jobId.
    const span = this.div.querySelector("#status" + jid);
    if (!span) {
      return;
    }

    let oldLevel = span.dataset.level;
    if (oldLevel === undefined) {
      oldLevel = 0;
    }
    if (newLevel > oldLevel) {
      span.dataset.level = newLevel;
      if (newLevel === 1) {
        span.classList.add("host-success");
      } else if (newLevel === 2) {
        span.classList.add("host-skips");
      } else if (newLevel === 3) {
        span.classList.add("host-failed");
      }
    }
    span.style.removeProperty("display");
  }
}
