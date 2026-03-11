import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-annotation-tool",
  version: version,
  parameters: {
    /**
     * stylesheet
     * use default as is, modify it, or use own stylesheet
     * preferably in jspsych/
     */
    stylesheet: {
      type: ParameterType.STRING,
      default: "jspsych/annotation-tool.css",
    },
    /**
     * dataset to annotate, as JSON array
     * can already have labels
     * e.g.
     * [
     *   { id: 0, text: "text 0" },
     *   { id: 1, text: "text 1", label: 0 },
     *   { id: 2, text: "text 2" },
     * ]
     */
    dataset: {
      type: ParameterType.OBJECT,
      array: true,
      default: undefined,
    },
    /**
     * labels to annotate data with
     * e.g. ["label0", "label1"]
     */
    labels: {
      type: ParameterType.STRING,
      array: true,
      default: undefined,
    },
    /**
     * if data can be annotated with multiple labels
     * if true, rapid mode is disabled
     */
    multi_labels: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
     * annotation guidelines, can be styled with html
     * e.g.
     * `<ol>
     *    <li>guideline 0</li>
     *    <li>guideline 1</li>
     *    <li>guideline 2</li>
     *  </ol>`
     */
    guidelines: {
      type: ParameterType.HTML_STRING,
      default: undefined,
    },
    /**
     * keyboard shortcuts
     * can be changed live when using the annotation tool, are stored locally
     */
    keyboard_shortcuts: {
      type: ParameterType.OBJECT,
      default: {
        all_items: "a",
        guidelines: "g",
        keyboard_shortcuts: "h",
        rapid_mode: "r",
        prev: "j",
        next: "k",
        save: "s",
        labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      },
    },
    /**
     * username of github account which owns the repository
     * in which the instance of the annotation tool is hosted
     */
    owner: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * name of repository in which the instance of the annotation tool is hosted
     */
    repo: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * github actions file, for saving to github
     * default:
     * creates branch with annotator name,
     * commits annotations/YYYY-MM-DD_HH-MM-SS_annotator.json, content is data below,
     * creates pull request (into default branch)
     */
    workflow: {
      type: ParameterType.STRING,
      default: "save-annotations.yml",
    },
  },
  data: {
    /**
     * annotator name
     * ideally without whitespace, but is cleaned later on
     */
    annotator: {
      type: ParameterType.STRING,
    },
    /**
     * annotated dataset, as JSON array again
     */
    annotated_dataset: {
      type: ParameterType.OBJECT,
      array: true,
    },
  },
  /* when you run build on your plugin,
     citations will be generated here based on the information in the CITATION.cff file. */
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-annotation-tool**
 * a browser-based serverless text annotation tool built in jsPsych
 *
 * allows annotating data with labels and saving annotated data to github
 * ideally hosted on github pages, so no need for a server
 *
 * structure:
 * - stylesheet
 * - dataset
 * - helpers: - function for making metadata string
 *            - function for creating a dialog box
 * - toolbar: - side panel that displays all items, allows navigating to each one
 *              (uses metadata string)
 *            - guidelines (uses dialog)
 *            - keyboard shortcuts (uses dialog)
 *            - progress bar
 *            - rapid mode (only for single-label annotation, not multi-label),
 *              after labelling an item, immediately moves to next one
 *            - previous and next buttons
 *            - saving to github (uses dialog)
 * - labels
 * - item (uses metadata string)
 * - function that updates ui (update item, prev next buttons, label buttons,
 *   progress bar, highlighting of 'all items', save annotated dataset and current item locally)
 */
class AnnotationToolPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    //////////////////// > STYLESHEETS ////////////////////
    // icons
    const faLink = document.createElement("link");
    faLink.rel = "stylesheet";
    faLink.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
    document.head.appendChild(faLink);

    // regular stylesheet
    const stylesheetLink = document.createElement("link");
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.href = trial.stylesheet.trim();
    document.head.appendChild(stylesheetLink);
    //////////////////// STYLESHEETS < ////////////////////

    //////////////////// > DATASET ////////////////////
    // expected structure of items in dataset
    type DatasetItem = {
      id: number;
      text: string;
      label?: number | number[];
      [key: string]: any;
    };

    /* common prefix 'ownerRepoAnnotation' for names of data saved locally
       this allows working on several instances of the annotation tool
       in the same browser on the same device at the same time */
    const owner = (trial.owner ?? "").toLowerCase().trim();
    const repoRaw = (trial.repo ?? "").toLowerCase().trim();
    const repo = repoRaw ? repoRaw.charAt(0).toUpperCase() + repoRaw.slice(1) : "";
    const LOCAL_STORAGE_PREFIX = `${owner}${repo}Annotation`;

    // locally saved annotated dataset
    const savedAnnotatedDataset = localStorage.getItem(LOCAL_STORAGE_PREFIX);
    /* if locally saved annotated dataset present, use that,
       otherwise deep-copy vanilla dataset from parameters */
    const annotatedDataset: DatasetItem[] = savedAnnotatedDataset
      ? JSON.parse(savedAnnotatedDataset)
      : (structuredClone(trial.dataset) as DatasetItem[]);

    /* index of current item
       used to move between items etc.
       load from local storage, otherwise 0 */
    let curIdx = Number(localStorage.getItem(LOCAL_STORAGE_PREFIX + "Index") ?? 0);
    //////////////////// DATASET < ////////////////////

    //////////////////// > HELPERS ////////////////////
    ///// > MAKE METADATA STRING /////
    /**
     * helper
     * make string containing metadata
     * used by 'all items' buttons, main item
     * @param item an item from dataset
     * @param itemIdx index of item
     * @param numItems total number of items in dataset
     */
    function makeMetadataString(item: DatasetItem, itemIdx: number, numItems: number): string {
      // basic metadata: position, id
      let metadata = `position: ${itemIdx + 1} of ${numItems} | id: ${item.id}`;
      // other metadata: other keys & values
      Object.entries(item).forEach(([key, value]) => {
        if (key !== "id" && key !== "text") {
          metadata += ` | ${key}: ${value}`;
        }
      });
      return metadata;
    }
    ///// MAKE METADATA STRING < /////

    ///// > DIALOG /////
    /* small box that displays text
       used by guidelines, keyboard shortcuts, save */

    const dialog = document.createElement("dialog");
    dialog.id = "jspsych-annotation-tool-dialog";
    display_element.appendChild(dialog);

    const dialogTitle = document.createElement("div");
    dialogTitle.id = "jspsych-annotation-tool-dialog-title";
    dialog.appendChild(dialogTitle);

    const dialogBody = document.createElement("div");
    dialogBody.id = "jspsych-annotation-tool-dialog-body";
    dialog.appendChild(dialogBody);

    /**
     * helper
     * shows dialog with specified title and text
     * used by guidelines, keyboard shortcuts, save
     * @param title a title
     * @param text can be styled with html
     */
    function showDialog(title: string, text: string) {
      dialogTitle.textContent = title;
      dialogBody.innerHTML = `
      ${text}
      <p class="jspsych-annotation-tool-dialog-note">Press Escape to close.</p>
      `;

      if (!dialog.open) {
        dialog.showModal();

        // in order to have nothing focused: focus dialog and then remove focus
        dialog.setAttribute("tabindex", "-1");
        dialog.focus();
        dialog.blur();

        // remove focus in general just in case
        const firstFocusedElem = dialog.querySelector<HTMLElement>("input, button, textarea");
        firstFocusedElem?.blur();
      }
    }
    ///// DIALOG < /////
    //////////////////// HELPERS < ////////////////////

    //////////////////// > TOOLBAR ////////////////////
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    const toolbarL = document.createElement("div");
    toolbarL.classList.add("toolbar-section", "left");
    toolbar.appendChild(toolbarL);

    const toolbarR = document.createElement("div");
    toolbarR.classList.add("toolbar-section", "right");
    toolbar.appendChild(toolbarR);

    ////////// > ALL ITEMS //////////
    // side panel with all items listed, each item is a button

    const allItemsContainer = document.createElement("div");
    allItemsContainer.id = "jspsych-annotation-tool-all-items";
    allItemsContainer.style.display = "none";
    display_element.appendChild(allItemsContainer);

    // array of item buttons, for easier updating
    const itemButtons: HTMLButtonElement[] = [];

    // add each item as button with text & metadata to side panel
    annotatedDataset.forEach((item: DatasetItem, itemIdx: number) => {
      const itemButton = document.createElement("button");
      // on item button click: show that item in main area & close side panel
      itemButton.addEventListener("click", () => {
        curIdx = itemIdx;
        updateUi();
      });
      itemButtons.push(itemButton);
      allItemsContainer.appendChild(itemButton);

      const itemText = document.createElement("span");
      itemText.classList.add("jspsych-annotation-tool-item-from-all-text");
      itemText.textContent = item.text;
      itemButton.appendChild(itemText);

      const itemMetadata = document.createElement("span");
      itemMetadata.classList.add("jspsych-annotation-tool-item-from-all-metadata");
      itemMetadata.textContent = makeMetadataString(item, itemIdx, annotatedDataset.length);
      itemButton.appendChild(itemMetadata);
    });

    // all items button in toolbar
    const allItemsButton = document.createElement("button");
    const allItemsIcon = document.createElement("i");
    allItemsIcon.className = "fa fa-bars fa-fw";
    // on all items button click: show/hide side panel
    allItemsButton.addEventListener("click", () => {
      if (allItemsContainer.style.display === "none") {
        allItemsContainer.style.display = "block";
      } else {
        allItemsContainer.style.display = "none";
      }
    });
    allItemsButton.appendChild(allItemsIcon);
    toolbarL.appendChild(allItemsButton);
    ////////// ALL ITEMS < //////////

    ////////// > GUIDELINES //////////
    const guidelinesButton = document.createElement("button");
    const guidelinesIcon = document.createElement("i");
    guidelinesIcon.className = "fa fa-book fa-fw";
    guidelinesButton.appendChild(guidelinesIcon);
    guidelinesButton.addEventListener("click", () => {
      showDialog("Guidelines", trial.guidelines ?? "No guidelines provided.");
    });
    toolbarL.appendChild(guidelinesButton);
    ////////// GUIDELINES < //////////

    ////////// > KEYBOARD SHORTCUTS //////////
    // expected structure of keyboard shortcuts
    type KeyboardShortcuts = {
      all_items: string;
      guidelines: string;
      keyboard_shortcuts: string;
      rapid_mode: string;
      prev: string;
      next: string;
      save: string;
      labels: string[];
    };

    // actions (from 'all items' to save), i.e. not labels
    type KeyboardShortcutsAction = Exclude<keyof KeyboardShortcuts, "labels">;

    // locally saved shortcuts
    const savedShortcuts = localStorage.getItem(LOCAL_STORAGE_PREFIX + "KeyboardShortcuts");
    /* if locally saved shortcuts present, use them,
       otherwise deep-copy vanilla shortcuts from parameters */
    const keyboardShortcuts: KeyboardShortcuts = savedShortcuts
      ? JSON.parse(savedShortcuts)
      : (structuredClone(trial.keyboard_shortcuts) as KeyboardShortcuts);

    // all keys to lower case
    Object.entries(keyboardShortcuts).forEach(([k, v]) => {
      if (k === "labels") {
        keyboardShortcuts.labels = keyboardShortcuts.labels.map((x) => x.toLowerCase());
        /* since default has label keys 1-9 and one might use them with fewer labels:
          make sure only the first x label keys are used, x is num of labels */
        keyboardShortcuts.labels = keyboardShortcuts.labels.slice(0, trial.labels.length);
      } else {
        keyboardShortcuts[k as KeyboardShortcutsAction] = (v as string).toLowerCase();
      }
    });

    /**
     * create the shortcuts editor in a table format that is shown in shortcuts dialog
     * lists each action name, then interactable button that displays currently assigned key
     * @param shortcuts current keyboard shortcuts
     * @param labels list of labels
     */
    function makeShortcutsTable(shortcuts: KeyboardShortcuts, labels: string[]) {
      let table = `<table class="shortcut-table">`;

      // regular action shortcuts
      for (const action in shortcuts) {
        // skip labels
        if (action === "labels") {
          continue;
        }
        const actionKey = shortcuts[action as KeyboardShortcutsAction];
        // action name & button with key on it
        table += `
      <tr>
        <td>${action.replace(/_/g, " ")}</td>
        <td>
          <button class="shortcut-capture" data-action="${action}">
            <span>${actionKey}</span>
          </button>
        </td>
      </tr>`;
      }

      // label shortcuts
      table += `<tr><th colspan="2">Labels</th></tr>`;
      labels.forEach((label, labelIdx) => {
        const labelKey = shortcuts.labels[labelIdx];
        // skip labels that do not exist
        if (!labelKey) {
          return;
        }
        // label name & button with key on it
        table += `
      <tr>
        <td>${label}</td>
        <td>
          <button class="shortcut-capture-label" data-index="${labelIdx}">
            <span>${labelKey}</span>
          </button>
        </td>
      </tr>`;
      });

      // put table together
      table += `</table>
    <p>Click on a shortcut and press a new key. Changes are saved automatically. Shortcuts are stored locally.</p>`;

      return table;
    }

    /**
     * helper for next function
     * check if the key one wants to assign to a shortcut
     * is already being used for another shortcut
     * @param key the key one wants to assign to a shortcut
     */
    function keyUsed(key: string): boolean {
      key = key.toLowerCase();
      const actionKeys = Object.entries(keyboardShortcuts)
        // skip labels, do them separately below
        .filter(([k]) => k !== "labels")
        // get the actual key assigned
        .map(([, v]) => v as string);
      const labelKeys = keyboardShortcuts.labels;
      return [...actionKeys, ...labelKeys].includes(key);
    }

    /**
     * allows capturing new shortcut when a shortcut button is clicked
     */
    function captureNewShortcut() {
      // select all shortcut buttons (regular & label)
      const buttons = document.querySelectorAll<HTMLElement>(
        ".shortcut-capture, .shortcut-capture-label"
      );

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const span = button.querySelector("span")!;
          const oldKey = span.textContent ?? "";
          span.textContent = "...";

          const keyboardListener = (e: KeyboardEvent) => {
            e.preventDefault();
            const newKey = e.key.toLowerCase();
            // if key already in use, warn and 'quit'
            if (keyUsed(newKey)) {
              alert(`Key "${newKey}" is already assigned to another shortcut.`);
              span.textContent = oldKey;
              // if key not in use,
            } else {
              // assign new key depending on type:
              // action
              if (button.dataset.action) {
                keyboardShortcuts[button.dataset.action as KeyboardShortcutsAction] = newKey;
                // label
              } else if (button.dataset.index) {
                keyboardShortcuts.labels[Number(button.dataset.index)] = newKey;
              }
              span.textContent = newKey;
              localStorage.setItem(
                LOCAL_STORAGE_PREFIX + "KeyboardShortcuts",
                JSON.stringify(keyboardShortcuts)
              );
            }
            startKeyboardShortcuts();

            document.removeEventListener("keydown", keyboardListener);
          };

          document.addEventListener("keydown", keyboardListener, { once: true });
        });
      });
    }

    const keyboardShortcutsButton = document.createElement("button");
    const keyboardShortcutsIcon = document.createElement("i");
    keyboardShortcutsIcon.className = "fa fa-keyboard-o fa-fw";
    keyboardShortcutsButton.appendChild(keyboardShortcutsIcon);
    keyboardShortcutsButton.addEventListener("click", () => {
      showDialog("Keyboard shortcuts", makeShortcutsTable(keyboardShortcuts, trial.labels));
      captureNewShortcut();
    });
    toolbarL.appendChild(keyboardShortcutsButton);

    ///// > ACTUAL KEYBOARD SHORTCUTS /////
    // so that using getKeyboardResponse within function & variable works
    const jsPsych = this.jsPsych;

    let keyboardListener: any = null;

    /**
     * keyboard shortcut listener as function to allow enabling/disabling based on circumstances
     */
    function startKeyboardShortcuts() {
      if (keyboardListener) {
        jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }

      keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: (info) => {
          const element = document.activeElement as HTMLElement | null;
          // input field already handled below, but just in case
          if (
            (element &&
              (element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.isContentEditable)) ||
            dialog.open
          ) {
            return;
          }

          // actual keyboard shortcuts
          switch (info.key.toLowerCase()) {
            case keyboardShortcuts.all_items:
              allItemsButton.click();
              break;
            case keyboardShortcuts.guidelines:
              guidelinesButton.click();
              break;
            case keyboardShortcuts.keyboard_shortcuts:
              keyboardShortcutsButton.click();
              break;
            case keyboardShortcuts.rapid_mode:
              rapidModeButton.click();
              break;
            case keyboardShortcuts.prev:
              prevButton.click();
              break;
            case keyboardShortcuts.next:
              nextButton.click();
              break;
            case keyboardShortcuts.save:
              saveButton.click();
              break;
          }

          // check if key pressed is in the array that holds the keys for the labels
          const labelIdx = keyboardShortcuts.labels.indexOf(info.key.toLowerCase());
          if (labelIdx !== -1 && labelIdx < labelButtons.length) {
            labelButtons[labelIdx].click();

            // in rapid mode: label & move on to next item
            if (!trial.multi_labels && rapidMode && curIdx < annotatedDataset.length - 1) {
              // extra time so that colour change of selected label is visible
              setTimeout(() => {
                curIdx++;
                updateUi();
              }, 50);
            }
          }
        },
        valid_responses: [
          ...Object.entries(keyboardShortcuts)
            .filter(([k]) => k !== "labels")
            .map(([, v]) => v as string),
          ...keyboardShortcuts.labels,
        ],
        persist: true,
        allow_held_key: false,
      });
    }

    // disable keyboard shortcuts when in input field
    display_element.addEventListener("focusin", (e) => {
      const elem = e.target as HTMLElement;
      if (elem.tagName === "INPUT" || elem.tagName === "TEXTAREA" || elem.isContentEditable) {
        this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }
    });

    // enable keyboard shortcuts again after exiting input field
    display_element.addEventListener("focusout", (e) => {
      const elem = e.target as HTMLElement;
      if (elem.tagName === "INPUT" || elem.tagName === "TEXTAREA" || elem.isContentEditable) {
        startKeyboardShortcuts();
      }
    });
    ///// ACTUAL KEYBOARD SHORTCUTS < /////
    ////////// KEYBOARD SHORTCUTS < //////////

    ////////// > PROGRESS BAR //////////
    const progressContainer = document.createElement("div");
    progressContainer.id = "jspsych-annotation-tool-progress-container";
    toolbar.appendChild(progressContainer);

    const progressBar = document.createElement("progress");
    progressBar.max = annotatedDataset.length;
    progressBar.value = 0;
    progressContainer.appendChild(progressBar);

    const progressText = document.createElement("span");
    progressContainer.appendChild(progressText);
    ////////// PROGRESS BAR < //////////

    ////////// > RAPID MODE //////////
    let rapidMode = false;

    const rapidModeButton = document.createElement("button");
    rapidModeButton.className = "rapid-mode-button";
    const rapidModeIcon = document.createElement("i");
    rapidModeIcon.className = "fa fa-bolt fa-fw";
    rapidModeButton.appendChild(rapidModeIcon);
    if (trial.multi_labels) {
      rapidModeButton.disabled = true;
      rapidModeButton.title = "Rapid mode disabled in multi-label mode";
    }
    rapidModeButton.addEventListener("click", () => {
      rapidMode = !rapidMode;
      rapidModeButton.classList.toggle("active", rapidMode);
    });
    toolbarR.appendChild(rapidModeButton);
    ////////// RAPID MODE < //////////

    ////////// > PREV NEXT //////////
    const prevButton = document.createElement("button");
    const prevIcon = document.createElement("i");
    prevIcon.className = "fa fa-chevron-left fa-fw";
    prevButton.appendChild(prevIcon);
    prevButton.disabled = curIdx === 0;
    prevButton.addEventListener("click", () => {
      if (curIdx > 0) {
        curIdx--;
        updateUi();
      }
    });
    toolbarR.appendChild(prevButton);

    const nextButton = document.createElement("button");
    const nextIcon = document.createElement("i");
    nextIcon.className = "fa fa-chevron-right fa-fw";
    nextButton.appendChild(nextIcon);
    nextButton.addEventListener("click", () => {
      if (curIdx < annotatedDataset.length - 1) {
        curIdx++;
        updateUi();
      }
    });
    toolbarR.appendChild(nextButton);
    ////////// PREV NEXT < //////////

    ////////// > SAVE //////////
    const saveButton = document.createElement("button");
    const saveIcon = document.createElement("i");
    saveIcon.className = "fa fa-save fa-fw";
    saveButton.appendChild(saveIcon);
    // get annotator name and token from local storage if existent
    saveButton.addEventListener("click", () => {
      showDialog(
        "Save to GitHub",
        `<div class="name-token-container">
         <div class="row">
         <label for="annotatorName">Name:</label>
         <input id="annotatorName" name="annotatorName" value="${
           localStorage.getItem(LOCAL_STORAGE_PREFIX + "AnnotatorName") ?? ""
         }">
         </div>
         <div class="row">
         <label for="token">Token:</label>
         <input type="password" id="token" name="token" value="${
           localStorage.getItem(LOCAL_STORAGE_PREFIX + "Token") ?? ""
         }">
         </div>
         </div>
         <p>Name and token are saved locally.</p>
         <div class="save-buttons">
         <button id="save-and-continue">save and continue</button>
         <button id="save-and-end">save and end</button>
         </div>`
      );

      /**
       * save annotated dataset to github via github workflow
       * workflow creates branch with annotator name,
       * commits annotations/YYYY-MM-DD_HH-MM-SS_annotator.json, content is data below,
       * creates pull request (into default branch)
       *
       * no github account needed, only token from repository owner
       * token must have these permissions in the repository:
       * read access to metadata, read and write access to actions
       * @param endAfter whether to close annotation tool after saving
       */
      async function saveToGitHub(endAfter: boolean) {
        const tokenInput = document.getElementById("token") as HTMLInputElement;
        const nameInput = document.getElementById("annotatorName") as HTMLInputElement;
        const token = tokenInput?.value.trim();
        let annotator = nameInput?.value.trim();

        if (!token) {
          return alert("Please enter a GitHub token.");
        }
        if (!annotator) {
          return alert("Please enter an annotator name.");
        }

        annotator = annotator.replace(/\s+/g, "-");

        localStorage.setItem(LOCAL_STORAGE_PREFIX + "AnnotatorName", annotator);
        localStorage.setItem(LOCAL_STORAGE_PREFIX + "Token", token);

        annotatedDataset.forEach((item) => {
          if (Array.isArray(item.label)) {
            // sort labels
            item.label = item.label.map(Number).sort((a, b) => a - b);
          }
        });

        // data to save
        const trialData = {
          annotator: annotator,
          annotated_dataset: annotatedDataset,
        };

        try {
          const response = await fetch(
            `https://api.github.com/repos/${(trial.owner ?? "").trim()}/${(
              trial.repo ?? ""
            ).trim()}/actions/workflows/${trial.workflow.trim()}/dispatches`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ref: "main",
                inputs: {
                  annotator,
                  dataset: JSON.stringify(trialData, null, 2),
                },
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
          }

          const successMsg = endAfter
            ? "Annotations successfully saved to GitHub. Quitting. Reload to reopen."
            : "Annotations successfully saved to GitHub. You may continue annotating.";

          alert(successMsg);

          if (endAfter) {
            jsPsych.pluginAPI.cancelAllKeyboardResponses();
            jsPsych.finishTrial(trialData);
          }
        } catch (error) {
          console.error(error);
          alert(
            "Failed to save annotations to GitHub. Check your input. Check console for details."
          );
        }
      }

      const saveAndContinue = document.getElementById("save-and-continue");
      saveAndContinue?.addEventListener("click", async () => {
        await saveToGitHub(false);
      });

      const saveAndEnd = document.getElementById("save-and-end");
      saveAndEnd?.addEventListener("click", async () => {
        await saveToGitHub(true);
      });
    });
    toolbarR.appendChild(saveButton);
    ////////// SAVE < //////////
    //////////////////// TOOLBAR < ////////////////////

    //////////////////// > LABELS ////////////////////
    const labelsContainer = document.createElement("div");
    labelsContainer.id = "jspsych-annotation-tool-labels-container";
    display_element.appendChild(labelsContainer);

    // array of label buttons, for easier updating
    const labelButtons: HTMLButtonElement[] = [];

    // create button for each label
    trial.labels.forEach((label, labelIdx) => {
      const labelButton = document.createElement("button");
      labelButton.className = "jspsych-annotation-tool-label-button";
      labelButton.textContent = label;
      labelButton.addEventListener("click", () => {
        const item = annotatedDataset[curIdx];
        // multi label annotation
        if (trial.multi_labels) {
          // make sure every 'label' key holds an array value
          if (!Array.isArray(item.label)) {
            item.label = [];
          }
          const labels = item.label as number[];
          // check if label already amongst labels assigned to cur item
          const pos = labels.indexOf(labelIdx);
          // if not, add
          if (pos === -1) {
            labels.push(labelIdx);
            // if it is, remove
          } else {
            labels.splice(pos, 1);
          }
          // if now item has no labels, delete 'labels'
          if (labels.length === 0) {
            delete item.label;
          }
          // single label annotation
        } else {
          // if label already assigned to cur item, delete 'label'
          if (item.label === labelIdx) {
            delete item.label;
            // otherwise assign label
          } else {
            item.label = labelIdx;
          }
        }
        updateUi();
      });
      labelButtons.push(labelButton);
      labelsContainer.appendChild(labelButton);
    });
    //////////////////// LABELS < ////////////////////

    //////////////////// > ITEM ////////////////////
    // current item in centre of screen

    const itemContainer = document.createElement("div");
    itemContainer.id = "jspsych-annotation-tool-item-container";
    display_element.appendChild(itemContainer);

    const itemText = document.createElement("p");
    itemText.id = "jspsych-annotation-tool-item";
    itemContainer.appendChild(itemText);

    const itemMetadata = document.createElement("p");
    itemMetadata.id = "jspsych-annotation-tool-metadata";
    itemContainer.appendChild(itemMetadata);
    //////////////////// ITEM < ////////////////////

    //////////////////// > UPDATE ////////////////////
    /**
     * update item, prev next buttons, label buttons, progress bar, highlighting of 'all items',
     * save annotated dataset and current item locally
     */
    function updateUi() {
      // - update item
      const item = annotatedDataset[curIdx];
      itemText.textContent = item.text;
      itemMetadata.textContent = makeMetadataString(item, curIdx, annotatedDataset.length);

      // - update prev next buttons
      prevButton.disabled = curIdx === 0;
      nextButton.disabled = curIdx === annotatedDataset.length - 1;

      // - update label buttons
      const curLabels = annotatedDataset[curIdx].label;
      labelButtons.forEach((labelButton, labelButtonIdx) => {
        // if multi labels allowed
        if (Array.isArray(curLabels)) {
          labelButton.classList.toggle("is-selected", curLabels.includes(labelButtonIdx));
          // if single label
        } else {
          labelButton.classList.toggle("is-selected", labelButtonIdx === curLabels);
        }
      });

      // - update progress bar
      const numLabelledItems = annotatedDataset.filter((item) => item.label !== undefined).length;
      progressBar.value = numLabelledItems;
      progressText.textContent = `${numLabelledItems} of ${annotatedDataset.length} annotated`;

      // - update 'all items' highlighting, highlights cur item in side panel
      itemButtons.forEach((itemButton, itemButtonIdx) => {
        // if the item button is the current item, highlight
        if (itemButtonIdx === curIdx) {
          itemButton.classList.add("highlighted");
          itemButton.disabled = true;
        } else {
          itemButton.classList.remove("highlighted");
          itemButton.disabled = false;
        }
      });

      /* - save annotated dataset & current idx to local storage
         allows continuous annotating without saving to github */
      localStorage.setItem(LOCAL_STORAGE_PREFIX, JSON.stringify(annotatedDataset));
      localStorage.setItem(LOCAL_STORAGE_PREFIX + "Index", String(curIdx));
    }
    //////////////////// UPDATE < ////////////////////

    // initial
    updateUi();
    startKeyboardShortcuts();
  }
}

export default AnnotationToolPlugin;
