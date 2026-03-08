// npm run build

import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-annotation-tool",
  version: version,
  parameters: {
    // user can use provided css as is, modify it, or use own css
    stylesheet: {
      type: ParameterType.STRING,
      default: "../src/annotation-tool.css",
    },
    dataset: {
      type: ParameterType.OBJECT,
      array: true,
    },
    labels: {
      type: ParameterType.STRING,
      array: true,
      default: undefined,
    },
    guidelines: {
      type: ParameterType.HTML_STRING,
      default: "",
    },
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
    owner: {
      type: ParameterType.STRING,
      default: undefined,
    },
    repo: {
      type: ParameterType.STRING,
      default: undefined,
    },
    workflow: {
      type: ParameterType.STRING,
      default: "save-annotations.yml",
    },
  },
  data: {
    annotator: {
      type: ParameterType.STRING,
    },
    labelled_dataset: {
      type: ParameterType.OBJECT,
      array: true,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-annotation-tool**
 *
 * annotation tool
 *
 * @author smh
 * @see {@link https://github.com/smhancode/jsPsych.git/tree/main/packages/plugin-annotation-tool/README.md}}
 */
class AnnotationToolPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    //////////////////// STYLESHEET START ////////////////////
    // icons
    const fa_link = document.createElement("link");
    fa_link.rel = "stylesheet";
    fa_link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
    document.head.appendChild(fa_link);

    // css
    const css_link = document.createElement("link");
    css_link.rel = "stylesheet";
    css_link.href = trial.stylesheet;
    document.head.appendChild(css_link);
    //////////////////// STYLESHEET END ////////////////////

    //////////////////// DATASET START ////////////////////
    // assumed structure of items in dataset
    type DatasetItemBase = {
      id: number;
      text: string;
      label?: number;
      [key: string]: any;
    };

    const labelled_dataset = structuredClone(trial.dataset) as DatasetItemBase[]; // deep clone

    let cur_index = 0;
    //////////////////// DATASET END ////////////////////

    //////////////////// TOOLBAR START ////////////////////
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    const toolbar_left = document.createElement("div");
    toolbar_left.classList.add("toolbar-section", "left");
    toolbar.appendChild(toolbar_left);

    const toolbar_right = document.createElement("div");
    toolbar_right.classList.add("toolbar-section", "right");
    toolbar.appendChild(toolbar_right);

    ///// METADATA STRING START /////
    function make_metadata_string(item: DatasetItemBase, index: number, total: number): string {
      // basic metadata: position, id
      let metadata = `position: ${index + 1} of ${total} | id: ${item.id}`;
      // other metadata: other keys & values
      Object.entries(item).forEach(([key, value]) => {
        if (key !== "id" && key !== "text") {
          metadata += ` | ${key}: ${value}`;
        }
      });
      return metadata;
    }
    ///// METADATA STRING END /////

    ////////// ALL ITEMS START //////////
    // side panel w/ all items listed
    const all_items = document.createElement("div");
    all_items.id = "jspsych-annotation-tool-all-items";
    all_items.style.display = "none";
    display_element.appendChild(all_items);

    const all_items_buttons: HTMLButtonElement[] = [];

    // add each item as button w/ text & metadata to side panel
    labelled_dataset.forEach((item, index) => {
      // item button
      const item_from_all_button = document.createElement("button");
      // text
      const item_from_all_text = document.createElement("span");
      item_from_all_text.classList.add("jspsych-annotation-tool-item-from-all-text");
      item_from_all_text.textContent = item.text;
      item_from_all_button.appendChild(item_from_all_text);
      // metadata
      const item_from_all_metadata = document.createElement("span");
      item_from_all_metadata.classList.add("jspsych-annotation-tool-item-from-all-metadata");
      item_from_all_metadata.textContent = make_metadata_string(
        item,
        index,
        labelled_dataset.length
      );
      item_from_all_button.appendChild(item_from_all_metadata);
      // on item button click: show that item in main area & close side panel
      item_from_all_button.addEventListener("click", () => {
        cur_index = index;
        update_text();
      });
      all_items_buttons.push(item_from_all_button);
      all_items.appendChild(item_from_all_button);
    });

    function update_all_items_highlight() {
      all_items_buttons.forEach((button, index) => {
        if (index === cur_index) {
          button.classList.add("is-selected");
          button.disabled = true;
        } else {
          button.classList.remove("is-selected");
          button.disabled = false;
        }
      });
    }

    // button to show/hide all items
    const all_items_button = document.createElement("button");
    const all_items_icon = document.createElement("icon");
    all_items_icon.className = "fa fa-bars fa-fw fa-lg";
    all_items_button.appendChild(all_items_icon);
    all_items_button.addEventListener("click", () => {
      if (all_items.style.display === "none") {
        all_items.style.display = "block";
      } else {
        all_items.style.display = "none";
      }
    });
    toolbar_left.appendChild(all_items_button);
    ////////// ALL ITEMS END //////////

    ///// POPUP START /////
    // popup container that holds actual popup box
    // used by guidelines, keyboard shortcuts
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
    const guidelines_icon = document.createElement("icon");
    guidelines_icon.className = "fa fa-book fa-fw fa-lg";
    guidelines_button.appendChild(guidelines_icon);
    guidelines_button.addEventListener("click", () => {
      show_popup("Guidelines", trial.guidelines);
    });
    toolbar_left.appendChild(guidelines_button);
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

    //   function generate_shortcuts_table(keyboard_shortcuts: KeyboardShortcuts, labels: string[]) {
    //     // build rows for normal keys, skip labels
    //     // convert into array of key, value pairs
    //     const key_rows = Object.entries(keyboard_shortcuts)
    //       // remove labels key
    //       .filter(([action_name]) => action_name !== "labels")
    //       // for each action, key pair: create html table row, replace _ w/ space
    //       .map(
    //         ([action_name, keyboard_key]) =>
    //           `<tr><td class="key">${keyboard_key}</td><td>${action_name.replace(
    //             /_/g,
    //             " "
    //           )}</td></tr>`
    //       )
    //       .join("");
    //
    //     // build rows for label shortcuts
    //     const label_rows = keyboard_shortcuts.labels
    //       // for each keyboard key, label index pair: create html table row
    //       .map((keyboard_key, label_index) => {
    //         // set label name
    //         const label_name = labels[label_index];
    //         if (!label_name) {
    //           return null;
    //         }
    //         // build html table row w/ keyboard key & label name
    //         return `<tr><td class="key">${keyboard_key}</td><td>${label_name}</td></tr>`;
    //       })
    //       // remove nulls
    //       .filter(Boolean)
    //       .join("");
    //
    //     // combine everything into table
    //     return `
    //   <table class="shortcut-table">
    //     ${key_rows}
    //     <tr><th colspan="2">Labels</th></tr>
    //     ${label_rows}
    //   </table>
    // `;
    //   }
    function generate_shortcuts_editor(shortcuts: KeyboardShortcuts, labels: string[]) {
      const rows = Object.entries(shortcuts)
        .filter(([action]) => action !== "labels")
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

      const label_rows = shortcuts.labels
        .map((key, i) => {
          const label = labels[i];
          if (!label) return "";
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

      return `
  <table class="shortcut-table">
    ${rows}
    <tr><th colspan="2">Labels</th></tr>
    ${label_rows}
  </table>
  <p>Click a shortcut and press a new key.</p>
  <button id="save-shortcuts-button">save shortcuts</button>
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
            if (shortcut_already_used(key)) return;
            const action = (btn as HTMLElement).dataset.action as KeyboardShortcutAction;
            keyboard_shortcuts[action] = key;
            btn.querySelector("span")!.textContent = key;
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
            if (shortcut_already_used(key)) return;
            const index = Number((btn as HTMLElement).dataset.index);
            keyboard_shortcuts.labels[index] = key;
            btn.querySelector("span")!.textContent = key;
            document.removeEventListener("keydown", listener);
          };
          document.addEventListener("keydown", listener, { once: true });
        });
      });
    }

    function enable_shortcut_save() {
      const save_btn = document.getElementById("save-shortcuts-button");
      save_btn?.addEventListener("click", () => {
        localStorage.setItem("local_keyboard_shortcuts", JSON.stringify(keyboard_shortcuts));
        const originalText = save_btn.textContent;
        save_btn.textContent = "saved!";
        setTimeout(() => {
          save_btn.textContent = originalText;
        }, 1500);
      });
    }

    const keyboard_shortcuts_button = document.createElement("button");
    const keyboard_shortcuts_icon = document.createElement("icon");
    keyboard_shortcuts_icon.className = "fa fa-keyboard-o fa-fw fa-lg";
    keyboard_shortcuts_button.appendChild(keyboard_shortcuts_icon);
    keyboard_shortcuts_button.addEventListener("click", () => {
      show_popup("Keyboard shortcuts", generate_shortcuts_editor(keyboard_shortcuts, trial.labels));
      enable_shortcut_capture();
      enable_shortcut_save();
    });
    toolbar_left.appendChild(keyboard_shortcuts_button);
    ////////// KEYBOARD SHORTCUTS END //////////

    ////////// PROGRESS START //////////
    // container
    const progress_container = document.createElement("div");
    progress_container.id = "jspsych-annotation-tool-progress-container";
    toolbar.appendChild(progress_container);

    // progress bar
    const progress_bar = document.createElement("progress");
    progress_bar.max = labelled_dataset.length;
    progress_bar.value = 0;
    progress_container.appendChild(progress_bar);

    // progress text
    const progress_text = document.createElement("span");
    progress_container.appendChild(progress_text);

    const update_progress = () => {
      const labelled_count = labelled_dataset.filter((item) => item.label !== undefined).length;
      progress_bar.value = labelled_count;
      progress_text.textContent = `${labelled_count} of ${labelled_dataset.length} labelled`;
    };
    ////////// PROGRESS END //////////

    ////////// RAPID MODE START //////////
    let rapid_mode = false;

    const rapid_mode_button = document.createElement("button");
    rapid_mode_button.className = "rapid-mode-button";
    const rapid_mode_icon = document.createElement("icon");
    rapid_mode_icon.className = "fa fa-bolt fa-fw fa-lg";
    rapid_mode_button.appendChild(rapid_mode_icon);
    rapid_mode_button.addEventListener("click", () => {
      rapid_mode = !rapid_mode;
      rapid_mode_button.classList.toggle("active", rapid_mode);
    });
    toolbar_right.appendChild(rapid_mode_button);
    ////////// RAPID MODE END //////////

    ////////// PREV NEXT START //////////
    const prev_button = document.createElement("button");
    const prev_icon = document.createElement("icon");
    prev_icon.className = "fa fa-chevron-left fa-fw fa-lg";
    prev_button.appendChild(prev_icon);
    prev_button.disabled = cur_index === 0;
    prev_button.addEventListener("click", () => {
      if (cur_index > 0) {
        cur_index--;
        update_text();
      }
    });
    toolbar_right.appendChild(prev_button);

    const next_button = document.createElement("button");
    const next_icon = document.createElement("icon");
    next_icon.className = "fa fa-chevron-right fa-fw fa-lg";
    next_button.appendChild(next_icon);
    next_button.addEventListener("click", () => {
      if (cur_index < labelled_dataset.length - 1) {
        cur_index++;
        update_text();
      }
    });
    toolbar_right.appendChild(next_button);
    ////////// PREV NEXT END //////////

    ////////// SAVE START //////////
    const save_button = document.createElement("button");
    const save_icon = document.createElement("icon");
    save_icon.className = "fa fa-save fa-fw fa-lg";
    save_button.appendChild(save_icon);
    save_button.addEventListener("click", () => {
      show_popup(
        "Save to GitHub",
        `<label for="name">Name:</label>
<input id="name" name="name">
<label for="token">Token:</label>
<input type="password" id="token" name="token">
<button id="save-and-continue">save and continue</button>
<button id="save-and-end">save and end</button>`
      );

      async function save_to_github(end_after: boolean) {
        const token_input = document.getElementById("github-token") as HTMLInputElement;
        const name_input = document.getElementById("annotator-name") as HTMLInputElement;

        const token = token_input?.value.trim();
        let annotator = name_input?.value.trim();

        if (!token) {
          alert("Please enter a GitHub token.");
          return;
        }

        if (!annotator) {
          alert("Please enter an annotator name.");
          return;
        }

        // sanitize annotator name for branch usage
        annotator = annotator.replace(/\s+/g, "-");

        const owner = trial.owner.trim();
        const repo = trial.repo.trim();
        const workflow = trial.workflow.trim();

        const trial_data = {
          annotator: annotator,
          labelled_dataset: labelled_dataset,
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

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text);
          }

          alert("Annotations successfully saved to GitHub.");

          if (end_after) {
            this.jsPsych.pluginAPI.cancelAllKeyboardResponses();

            this.jsPsych.finishTrial({
              saved_to_github: true,
              annotator: annotator,
            });
          }
        } catch (err) {
          console.error(err);
          alert("Failed to trigger GitHub workflow. Check console for details.");
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

      // FOR TESTING START //
      // const trial_data = {
      //   annotator: "example annotator",
      //   labelled_dataset: labelled_dataset,
      // };
      // const blob = new Blob([JSON.stringify([trial_data], null, 2)], { type: "application/json" });
      // const link = document.createElement("a");
      // link.href = URL.createObjectURL(blob);
      // link.download = `${trial_data.annotator}.json`;
      // link.click();
      // FOR TESTING END //
    });
    toolbar_right.appendChild(save_button);
    ////////// SAVE END //////////
    //////////////////// TOOLBAR END ////////////////////

    //////////////////// LABELS START ////////////////////
    // container
    const labels_container = document.createElement("div");
    labels_container.id = "jspsych-annotation-tool-labels-container";
    display_element.appendChild(labels_container);

    const label_buttons: HTMLButtonElement[] = [];

    function update_label_buttons() {
      const current = labelled_dataset[cur_index].label;

      label_buttons.forEach((btn, i) => {
        btn.classList.toggle("is-selected", i === current);
      });
    }

    // create button for each label
    trial.labels.forEach((label, label_index) => {
      const label_button = document.createElement("button");
      label_button.className = "jspsych-annotation-tool-label-button";
      label_button.textContent = label;

      label_button.addEventListener("click", () => {
        if (labelled_dataset[cur_index].label === label_index) {
          delete labelled_dataset[cur_index].label;
        } else {
          labelled_dataset[cur_index].label = label_index;
        }
        update_text();
        update_label_buttons();
        update_progress();
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
    function update_text() {
      const item = labelled_dataset[cur_index];
      // update text
      item_text.textContent = item.text;
      // update metadata
      item_metadata.textContent = make_metadata_string(item, cur_index, labelled_dataset.length);

      // update prev next buttons
      prev_button.disabled = cur_index === 0;
      next_button.disabled = cur_index === labelled_dataset.length - 1;

      update_label_buttons();
      update_progress();
      update_all_items_highlight();
    }
    //////////////////// ITEM END ////////////////////

    //////////////////// ACTUAL KEYBOARD SHORTCUTS START ////////////////////
    this.jsPsych.pluginAPI.getKeyboardResponse({
      callback_function: (info) => {
        // esc to close popup
        if (info.key === "Escape" && popup_container.style.display !== "none") {
          popup_container.click();
          return;
        }
        // shortcuts deactivated when popup open
        if (popup_container.style.display !== "none") {
          return;
        }
        // shortcuts deactivated when typing
        const element = document.activeElement as HTMLElement | null;
        if (
          element &&
          (element.tagName === "INPUT" ||
            element.tagName === "TEXTAREA" ||
            element.isContentEditable)
        ) {
          return;
        }

        // actual keyboard shortcuts
        if (info.key === keyboard_shortcuts.all_items) {
          all_items_button.click();
        }
        if (info.key === keyboard_shortcuts.guidelines) {
          guidelines_button.click();
        }
        if (info.key === keyboard_shortcuts.keyboard_shortcuts) {
          keyboard_shortcuts_button.click();
        }
        if (info.key === keyboard_shortcuts.rapid_mode) {
          rapid_mode_button.click();
        }
        if (info.key === keyboard_shortcuts.prev) {
          prev_button.click();
        }
        if (info.key === keyboard_shortcuts.next) {
          next_button.click();
        }
        if (info.key === keyboard_shortcuts.save) {
          save_button.click();
        }

        // shortcuts 1-9 for labels
        // check if key pressed is in the array that holds the keys for the labels 1/2
        const label_index = keyboard_shortcuts.labels.indexOf(info.key);

        // check if key pressed is in the array that holds the keys for the labels 2/2
        if (label_index !== -1 && label_index < label_buttons.length) {
          label_buttons[label_index].click();

          // in rapid mode: label & move on to next item
          if (rapid_mode && cur_index < labelled_dataset.length - 1) {
            // extra time so that colour change of selected label is visible
            setTimeout(() => {
              cur_index++;
              update_text();
            }, 50);
          }
        }
      },
      valid_responses: "ALL_KEYS",
      persist: true,
      allow_held_key: false,
    });
    //////////////////// ACTUAL KEYBOARD SHORTCUTS END ////////////////////

    // initial
    update_text();
  }
}

export default AnnotationToolPlugin;
