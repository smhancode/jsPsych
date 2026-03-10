import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-annotation-tool",
  version: version,
  // parameters:
  parameters: {
    /* use default css as is, modify it, or use own css
       must be in jspsych/ */
    stylesheet: {
      type: ParameterType.STRING,
      default: "annotation-tool.css",
    },
    /* dataset to annotate, as JSON array
       e.g.
       [
         { id: 0, text: "text 0" },
         { id: 1, text: "text 1", label: 0 },
         { id: 2, text: "text 2" },
       ] */
    dataset: {
      type: ParameterType.OBJECT,
      array: true,
      default: undefined,
    },
    /* labels to label data with
       e.g. ["label0", "label1"] */
    labels: {
      type: ParameterType.STRING,
      array: true,
      default: undefined,
    },
    /* if data can be labelled with multiple labels
       boolean true/false */
    multi_labels: {
      type: ParameterType.BOOL,
      default: false,
    },
    /* annotation guidelines, as regular text or styled with html
       e.g.
       `
       <ol>
         <li>guideline 0</li>
         <li>guideline 1</li>
         <li>guideline 2</li>
       </ol>
       `
     */
    guidelines: {
      type: ParameterType.HTML_STRING,
      default: undefined,
    },
    // keyboard shortcuts
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
    /* github account username which owns the repository
       in which the instance of the annotation tool is hosted */
    owner: {
      type: ParameterType.STRING,
      default: undefined,
    },
    // repository name
    repo: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /* use default github actions file, modify it, or use own file
       must be in .github/workflows/ */
    workflow: {
      type: ParameterType.STRING,
      default: "save-annotations.yml",
    },
  },

  // data saved:
  data: {
    // annotator name
    annotator: {
      type: ParameterType.STRING,
    },
    // labelled dataset, as JSON array again
    annotated_dataset: {
      type: ParameterType.OBJECT,
      array: true,
    },
  },
  /* when you run build on your plugin,
     citations will be generated here based on the information in the CITATION.cff file. */
  citations: "__CITATIONS__",
};

//////////////////// TYPES START ////////////////////
type Info = typeof info;

// expected structure of items in dataset
type DatasetItem = {
  id: number;
  text: string;
  label?: number | number[];
  [key: string]: any;
};
//////////////////// TYPES END ////////////////////

/**
 * **plugin-annotation-tool**
 *
 * a browser-based serverless text annotation tool built in jsPsych
 *
 *
 */
class AnnotationToolPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    //////////////////// STYLESHEETS START ////////////////////
    // icons
    const faLink = document.createElement("link");
    faLink.rel = "stylesheet";
    faLink.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
    document.head.appendChild(faLink);

    // regular css
    const stylesheetLink = document.createElement("link");
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.href = "jspsych/" + trial.stylesheet.trim();
    document.head.appendChild(stylesheetLink);
    //////////////////// STYLESHEETS END ////////////////////

    //////////////////// DATASET START ////////////////////
    /* common prefix for names of data saved locally
       this allows working on several instances of the annotation tool
       in the same browser on the same device at the same time */
    const LOCAL_STORAGE_PREFIX = `${trial.owner}_${trial.repo}_annotation`;

    // locally saved annotated dataset
    const savedAnnotatedDataset = localStorage.getItem(LOCAL_STORAGE_PREFIX);
    /* if locally saved annotated dataset present, load that,
       otherwise deep-copy vanilla dataset from parameters */
    const annotatedDataset = savedAnnotatedDataset
      ? JSON.parse(savedAnnotatedDataset)
      : (structuredClone(trial.dataset) as DatasetItem[]);

    /* current index
       used to move between items etc.
       load from local storage, otherwise 0 */
    let curIdx = Number(localStorage.getItem(LOCAL_STORAGE_PREFIX + "_index") ?? 0);
    //////////////////// DATASET END ////////////////////

    //////////////////// TOOLBAR START ////////////////////
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    const toolbarL = document.createElement("div");
    toolbarL.classList.add("toolbar-section", "left");
    toolbar.appendChild(toolbarL);

    const toolbarR = document.createElement("div");
    toolbarR.classList.add("toolbar-section", "right");
    toolbar.appendChild(toolbarR);

    ///// MAKE METADATA STRING START /////
    /* make string containing metadata
       used in 'all items' buttons, main item */
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
    ///// MAKE METADATA STRING END /////

    ////////// ALL ITEMS START //////////
    // side panel with all items listed, each item is a button

    const allItemsContainer = document.createElement("div");
    allItemsContainer.id = "jspsych-annotation-tool-all-items";
    allItemsContainer.style.display = "none";
    display_element.appendChild(allItemsContainer);

    /* list of all the item buttons
       for easier updating */
    const itemButtons: HTMLButtonElement[] = [];

    // add each item as button with text & metadata to side panel
    annotatedDataset.forEach((item: DatasetItem, itemIdx: number) => {
      const itemButton = document.createElement("button");

      const itemText = document.createElement("span");
      itemText.classList.add("jspsych-annotation-tool-item-from-all-text");
      itemText.textContent = item.text;
      itemButton.appendChild(itemText);

      const itemMetadata = document.createElement("span");
      itemMetadata.classList.add("jspsych-annotation-tool-item-from-all-metadata");
      itemMetadata.textContent = makeMetadataString(item, itemIdx, annotatedDataset.length);
      itemButton.appendChild(itemMetadata);

      // on item button click: show that item in main area & close side panel
      itemButton.addEventListener("click", () => {
        curIdx = itemIdx;
        update_text_and_others();
      });

      itemButtons.push(itemButton);
      allItemsContainer.appendChild(itemButton);
    });

    // all items button in toolbar
    const allItemsButton = document.createElement("button");
    const allItemsIcon = document.createElement("i");
    allItemsIcon.className = "fa fa-bars fa-fw fa-lg";
    allItemsButton.appendChild(allItemsIcon);

    // on all items button click: show/hide side panel
    allItemsButton.addEventListener("click", () => {
      if (allItemsContainer.style.display === "none") {
        allItemsContainer.style.display = "block";
      } else {
        allItemsContainer.style.display = "none";
      }
    });

    toolbarL.appendChild(allItemsButton);
    ////////// ALL ITEMS END //////////

    ///// POPUP START /////
    /* opens small box that displays text
       used by guidelines, keyboard shortcuts, save */

    // popup container that holds actual popup box
    const popup_container = document.createElement("div");
    popup_container.id = "jspsych-annotation-tool-popup-container";
    popup_container.style.display = "none";
    // click anywhere outside popup box to close 1/2
    popup_container.addEventListener("click", () => {
      popup_container.style.display = "none";
    });
    display_element.appendChild(popup_container);

    // actual popup box that has the text
    const popup_box = document.createElement("div");
    popup_box.id = "jspsych-annotation-tool-popup-box";
    // click anywhere outside popup box to close 2/2
    popup_box.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    popup_container.appendChild(popup_box);

    // title
    const popup_title = document.createElement("div");
    popup_title.id = "jspsych-annotation-tool-popup-title";
    popup_box.appendChild(popup_title);

    // text
    // can take html styled text 1/2
    const popup_text = document.createElement("div");
    popup_text.id = "jspsych-annotation-tool-popup-text";
    popup_box.appendChild(popup_text);

    // show popup w/ specified title & text
    function show_popup(title: string, text: string) {
      popup_title.textContent = title;
      // can take html styled text 2/2
      popup_text.innerHTML = text;
      popup_container.style.display = "flex";
    }
    ///// POPUP END /////

    ////////// GUIDELINES START //////////
    const guidelines_button = document.createElement("button");
    const guidelines_icon = document.createElement("i");
    guidelines_icon.className = "fa fa-book fa-fw fa-lg";
    guidelines_button.appendChild(guidelines_icon);
    guidelines_button.addEventListener("click", () => {
      show_popup("Guidelines", trial.guidelines);
    });
    toolbarL.appendChild(guidelines_button);
    ////////// GUIDELINES END //////////

    ////////// KEYBOARD SHORTCUTS START //////////
    // assumed/expected structure of keyboard shortcuts
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
    type KeyboardShortcutAction = Exclude<keyof KeyboardShortcuts, "labels">;

    // const keyboard_shortcuts = trial.keyboard_shortcuts as KeyboardShortcuts;
    const default_shortcuts = trial.keyboard_shortcuts as KeyboardShortcuts;

    const saved_shortcuts = localStorage.getItem("local_keyboard_shortcuts");

    const keyboard_shortcuts: KeyboardShortcuts = saved_shortcuts
      ? JSON.parse(saved_shortcuts)
      : structuredClone(default_shortcuts);

    function shortcut_already_used(key: string): boolean {
      const normal_keys = Object.entries(keyboard_shortcuts)
        .filter(([k]) => k !== "labels")
        .map(([, v]) => v as string);

      const label_keys = keyboard_shortcuts.labels;

      return [...normal_keys, ...label_keys].includes(key);
    }

    function generate_shortcuts_editor(shortcuts: KeyboardShortcuts, labels: string[]) {
      // rows for regular keys
      // convert into array of key, value pairs
      const rows = Object.entries(shortcuts)
        .filter(([action]) => action !== "labels") // skip labels key
        // for each action, key pair: create html table row, replace _ with space
        .map(([action, key]) => {
          return `
      <tr>
        <td>${action.replace(/_/g, " ")}</td>
        <td>
          <button class="shortcut-capture" data-action="${action}">
            <span>${key}</span>
          </button>
        </td>
      </tr>`;
        })
        .join("");

      // build rows for label shortcuts
      const label_rows = shortcuts.labels
        // for each keyboard key, label index pair: create html table row
        .map((key, i) => {
          // set label name
          const label = labels[i];
          if (!label) return "";
          // build html table row w/ keyboard key & label name
          return `
      <tr>
        <td>${label}</td>
        <td>
          <button class="shortcut-capture-label" data-index="${i}">
            <span>${key}</span>
          </button>
        </td>
      </tr>`;
        })
        .join("");

      // combine everything into table
      return `
  <table class="shortcut-table">
    ${rows}
    <tr><th colspan="2">Labels</th></tr>
    ${label_rows}
  </table>
  <p>Click on a shortcut and press a new key. Changes are saved automatically.</p>
  `;
    }

    function enable_shortcut_capture() {
      const buttons = document.querySelectorAll(".shortcut-capture");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.querySelector("span")!.textContent = "...";
          const listener = (e: KeyboardEvent) => {
            e.preventDefault();
            const key = e.key.toLowerCase();
            if (shortcut_already_used(key)) {
              alert(`Key "${key}" is already assigned to another shortcut.`);
              btn.querySelector("span")!.textContent =
                keyboard_shortcuts[(btn as HTMLElement).dataset.action as KeyboardShortcutAction];
              return;
            }
            const action = (btn as HTMLElement).dataset.action as KeyboardShortcutAction;
            keyboard_shortcuts[action] = key;
            btn.querySelector("span")!.textContent = key;
            localStorage.setItem("local_keyboard_shortcuts", JSON.stringify(keyboard_shortcuts));
            document.removeEventListener("keydown", listener);
          };
          document.addEventListener("keydown", listener, { once: true });
        });
      });
      const label_buttons = document.querySelectorAll(".shortcut-capture-label");
      label_buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.querySelector("span")!.textContent = "...";
          const listener = (e: KeyboardEvent) => {
            e.preventDefault();
            const key = e.key.toLowerCase();
            if (shortcut_already_used(key)) {
              alert(`Key "${key}" is already assigned to another shortcut.`);
              const index = Number((btn as HTMLElement).dataset.index);
              btn.querySelector("span")!.textContent = keyboard_shortcuts.labels[index];
              return;
            }
            const index = Number((btn as HTMLElement).dataset.index);
            keyboard_shortcuts.labels[index] = key;
            btn.querySelector("span")!.textContent = key;
            localStorage.setItem("local_keyboard_shortcuts", JSON.stringify(keyboard_shortcuts));
            document.removeEventListener("keydown", listener);
          };
          document.addEventListener("keydown", listener, { once: true });
        });
      });
    }

    const keyboard_shortcuts_button = document.createElement("button");
    const keyboard_shortcuts_icon = document.createElement("i");
    keyboard_shortcuts_icon.className = "fa fa-keyboard-o fa-fw fa-lg";
    keyboard_shortcuts_button.appendChild(keyboard_shortcuts_icon);
    keyboard_shortcuts_button.addEventListener("click", () => {
      show_popup("Keyboard shortcuts", generate_shortcuts_editor(keyboard_shortcuts, trial.labels));
      enable_shortcut_capture();
    });
    toolbarL.appendChild(keyboard_shortcuts_button);
    ////////// KEYBOARD SHORTCUTS END //////////

    ////////// PROGRESS START //////////
    // container
    const progress_container = document.createElement("div");
    progress_container.id = "jspsych-annotation-tool-progress-container";
    toolbar.appendChild(progress_container);

    // progress bar
    const progress_bar = document.createElement("progress");
    progress_bar.max = annotatedDataset.length;
    progress_bar.value = 0;
    progress_container.appendChild(progress_bar);

    // progress text
    const progress_text = document.createElement("span");
    progress_container.appendChild(progress_text);

    const update_progress = () => {
      const labelled_count = annotatedDataset.filter((item) => item.label !== undefined).length;
      progress_bar.value = labelled_count;
      progress_text.textContent = `${labelled_count} of ${annotatedDataset.length} labelled`;
    };
    ////////// PROGRESS END //////////

    ////////// RAPID MODE START //////////
    let rapid_mode = false;

    const rapid_mode_button = document.createElement("button");
    rapid_mode_button.className = "rapid-mode-button";
    const rapid_mode_icon = document.createElement("i");
    rapid_mode_icon.className = "fa fa-bolt fa-fw fa-lg";
    rapid_mode_button.appendChild(rapid_mode_icon);
    if (trial.multi_labels) {
      rapid_mode_button.disabled = true;
      rapid_mode_button.title = "Rapid mode disabled in multi-label mode";
    }
    rapid_mode_button.addEventListener("click", () => {
      rapid_mode = !rapid_mode;
      rapid_mode_button.classList.toggle("active", rapid_mode);
    });
    toolbarR.appendChild(rapid_mode_button);
    ////////// RAPID MODE END //////////

    ////////// PREV NEXT START //////////
    const prev_button = document.createElement("button");
    const prev_icon = document.createElement("i");
    prev_icon.className = "fa fa-chevron-left fa-fw fa-lg";
    prev_button.appendChild(prev_icon);
    prev_button.disabled = curIdx === 0;
    prev_button.addEventListener("click", () => {
      if (curIdx > 0) {
        curIdx--;
        update_text_and_others();
      }
    });
    toolbarR.appendChild(prev_button);

    const next_button = document.createElement("button");
    const next_icon = document.createElement("i");
    next_icon.className = "fa fa-chevron-right fa-fw fa-lg";
    next_button.appendChild(next_icon);
    next_button.addEventListener("click", () => {
      if (curIdx < annotatedDataset.length - 1) {
        curIdx++;
        update_text_and_others();
      }
    });
    toolbarR.appendChild(next_button);
    ////////// PREV NEXT END //////////

    ////////// SAVE START //////////
    const save_button = document.createElement("button");
    const save_icon = document.createElement("i");
    save_icon.className = "fa fa-save fa-fw fa-lg";
    save_button.appendChild(save_icon);
    save_button.addEventListener("click", () => {
      show_popup(
        "Save to GitHub",
        `<label for="annotator-name">Name:</label>
<input id="annotator-name" name="annotator-name" value="${
          localStorage.getItem("annotator_name") ?? ""
        }">
<label for="github-token">Token:</label>
<input type="password" id="github-token" name="github-token" value="${
          localStorage.getItem("github_token") ?? ""
        }">
<p>Annotator name and token are saved locally.</p>
<button id="save-and-continue">save and continue</button>
<button id="save-and-end">save and end</button>`
      );

      async function save_to_github(end_after: boolean) {
        const token_input = document.getElementById("github-token") as HTMLInputElement;
        const name_input = document.getElementById("annotator-name") as HTMLInputElement;

        const token = token_input?.value.trim();
        let annotator = name_input?.value.trim();

        localStorage.setItem("annotator_name", annotator);
        localStorage.setItem("github_token", token);

        if (!token) {
          alert("Please enter a GitHub token.");
          return;
        }

        if (!annotator) {
          alert("Please enter an annotator name.");
          return;
        }

        annotator = annotator.replace(/\s+/g, "-");

        const owner = trial.owner.trim();
        const repo = trial.repo.trim();
        const workflow = trial.workflow.trim();

        annotatedDataset.forEach((item) => {
          if (Array.isArray(item.label)) {
            // coerce to numbers in case strings sneaked in
            item.label = item.label.map(Number).sort((a, b) => a - b);
          }
        });

        const trial_data = {
          annotator: annotator,
          annotated_dataset: annotatedDataset,
        };

        try {
          const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
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
                  annotator: annotator,
                  dataset: JSON.stringify(trial_data, null, 2),
                },
              }),
            }
          );

          if (res.ok) {
            if (end_after) {
              alert("Annotations successfully saved to GitHub. Quitting. Reload to reopen.");
              jsPsych.pluginAPI.cancelAllKeyboardResponses();
              jsPsych.finishTrial(trial_data);
            } else {
              alert("Annotations successfully saved to GitHub. You may continue annotating.");
            }
          } else {
            const text = await res.text();
            throw new Error(text);
          }
        } catch (err) {
          console.error(err);
          alert("Failed to save annotations to GitHub. Check console for details.");
        }
      }

      const save_and_continue = document.getElementById("save-and-continue");
      save_and_continue?.addEventListener("click", async () => {
        await save_to_github(false);
      });

      const save_and_end = document.getElementById("save-and-end");
      save_and_end?.addEventListener("click", async () => {
        await save_to_github(true);
      });
    });
    toolbarR.appendChild(save_button);
    ////////// SAVE END //////////
    //////////////////// TOOLBAR END ////////////////////

    //////////////////// LABELS START ////////////////////
    // container
    const labels_container = document.createElement("div");
    labels_container.id = "jspsych-annotation-tool-labels-container";
    display_element.appendChild(labels_container);

    const label_buttons: HTMLButtonElement[] = [];

    function update_label_buttons() {
      const current = annotatedDataset[curIdx].label;

      label_buttons.forEach((btn, i) => {
        if (Array.isArray(current)) {
          btn.classList.toggle("is-selected", current.includes(i));
        } else {
          btn.classList.toggle("is-selected", i === current);
        }
      });
    }

    // create button for each label
    trial.labels.forEach((label, label_index) => {
      const label_button = document.createElement("button");
      label_button.className = "jspsych-annotation-tool-label-button";
      label_button.textContent = label;

      label_button.addEventListener("click", () => {
        const item = annotatedDataset[curIdx];
        if (trial.multi_labels) {
          if (!Array.isArray(item.label)) {
            item.label = [];
          }
          const labels = item.label as number[];
          const pos = labels.indexOf(label_index); // if label already in label list
          if (pos === -1) {
            labels.push(label_index);
          } else {
            labels.splice(pos, 1);
          }
          if (labels.length === 0) {
            delete item.label;
          }
        } else {
          if (item.label === label_index) {
            delete item.label;
          } else {
            item.label = label_index;
          }
        }
        update_text_and_others();
        // update_label_buttons();
        // update_progress();
      });

      label_buttons.push(label_button);
      labels_container.appendChild(label_button);
    });
    //////////////////// LABELS END ////////////////////

    //////////////////// ITEM START ////////////////////
    // item container
    const item_container = document.createElement("div");
    item_container.id = "jspsych-annotation-tool-item-container";
    display_element.appendChild(item_container);

    // actual item text
    const item_text = document.createElement("p");
    item_text.id = "jspsych-annotation-tool-item";
    item_container.appendChild(item_text);

    // metadata
    const item_metadata = document.createElement("p");
    item_metadata.id = "jspsych-annotation-tool-metadata";
    item_container.appendChild(item_metadata);

    // update item
    function update_text_and_others() {
      const item = annotatedDataset[curIdx];
      // update text
      item_text.textContent = item.text;
      // update metadata
      item_metadata.textContent = makeMetadataString(item, curIdx, annotatedDataset.length);

      // update prev next buttons
      prev_button.disabled = curIdx === 0;
      next_button.disabled = curIdx === annotatedDataset.length - 1;

      update_label_buttons();
      update_progress();

      // highlight the current item in the 'all items' side panel
      // update all items highlight
      // go over all item buttons
      itemButtons.forEach((itemButton, itemButtonIdx) => {
        /* if the item button is the current item,
           highlight */
        if (itemButtonIdx === curIdx) {
          itemButton.classList.add("highlighted");
          itemButton.disabled = true;
        } else {
          itemButton.classList.remove("highlighted");
          itemButton.disabled = false;
        }
      });

      /* save annotated dataset & current idx to local storage
         allows continuing work without saving to github */
      localStorage.setItem(LOCAL_STORAGE_PREFIX, JSON.stringify(annotatedDataset));
      localStorage.setItem(LOCAL_STORAGE_PREFIX + "_index", String(curIdx));
    }
    //////////////////// ITEM END ////////////////////

    //////////////////// ACTUAL KEYBOARD SHORTCUTS START ////////////////////
    const jsPsych = this.jsPsych;
    let keyboardListener: any = null;
    function startKeyboardShortcuts() {
      keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: (info) => {
          // esc to close popup
          if (info.key === "Escape" && popup_container.style.display !== "none") {
            popup_container.click();
            return;
          }

          const element = document.activeElement as HTMLElement | null;
          if (
            (element &&
              (element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.isContentEditable)) ||
            popup_container.style.display !== "none"
          ) {
            return; // do nothing, allow normal typing
          }

          // actual keyboard shortcuts
          switch (info.key) {
            case keyboard_shortcuts.all_items:
              allItemsButton.click();
              break;
            case keyboard_shortcuts.guidelines:
              if (popup_container.style.display !== "none") {
                popup_container.click();
              } else {
                guidelines_button.click();
              }
              break;
            case keyboard_shortcuts.keyboard_shortcuts:
              if (popup_container.style.display !== "none") {
                popup_container.click();
              } else {
                keyboard_shortcuts_button.click();
              }
              break;
            case keyboard_shortcuts.rapid_mode:
              rapid_mode_button.click();
              break;
            case keyboard_shortcuts.prev:
              prev_button.click();
              break;
            case keyboard_shortcuts.next:
              next_button.click();
              break;
            case keyboard_shortcuts.save:
              save_button.click();
              break;
          }

          // shortcuts 1-9 for labels
          // check if key pressed is in the array that holds the keys for the labels 1/2
          const label_index = keyboard_shortcuts.labels.indexOf(info.key);

          // check if key pressed is in the array that holds the keys for the labels 2/2
          if (label_index !== -1 && label_index < label_buttons.length) {
            label_buttons[label_index].click();

            // in rapid mode: label & move on to next item
            if (!trial.multi_labels && rapid_mode && curIdx < annotatedDataset.length - 1) {
              // extra time so that colour change of selected label is visible
              setTimeout(() => {
                curIdx++;
                update_text_and_others();
              }, 50);
            }
          }
        },
        valid_responses: [
          ...Object.entries(keyboard_shortcuts)
            .filter(([k]) => k !== "labels")
            .map(([, v]) => v as string),
          ...keyboard_shortcuts.labels,
          "Escape",
        ],
        persist: true,
        allow_held_key: false,
      });
    }

    display_element.addEventListener("focusin", (e) => {
      const elem = e.target as HTMLElement;
      if (elem.tagName === "INPUT" || elem.tagName === "TEXTAREA" || elem.isContentEditable) {
        this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }
    });

    display_element.addEventListener("focusout", (e) => {
      const elem = e.target as HTMLElement;
      if (elem.tagName === "INPUT" || elem.tagName === "TEXTAREA" || elem.isContentEditable) {
        startKeyboardShortcuts();
      }
    });
    //////////////////// ACTUAL KEYBOARD SHORTCUTS END ////////////////////

    // initial
    update_text_and_others();
    startKeyboardShortcuts();
  }
}

export default AnnotationToolPlugin;
