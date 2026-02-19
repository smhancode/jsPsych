// npm run build

import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-annotation-tool",
  version: version,
  parameters: {
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
      default: "<p>This is a <bold>guidelines</bold> example.</p>",
    },
  },
  data: {
    labelled_dataset: {
      type: ParameterType.OBJECT,
      array: true,
    },
    annotator: {
      type: ParameterType.STRING,
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
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = trial.stylesheet;
    document.head.appendChild(link);
    //////////////////// STYLESHEET END ////////////////////

    //////////////////// DATASET START ////////////////////
    // assumed structure of items in dataset
    type dataset_item_base = {
      id: number;
      text: string;
      label?: number;
      [key: string]: any;
    };

    let labelled_dataset = structuredClone(trial.dataset) as dataset_item_base[]; // deep clone

    let cur_index = 0;
    //////////////////// DATASET END ////////////////////

    //////////////////// TOOLBAR START ////////////////////
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    ///// METADATA STRING START /////
    function make_metadata_string(item: dataset_item_base, index: number, total: number): string {
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
    // add each item as button w/ text & metadata to side panel
    labelled_dataset.forEach((item, index) => {
      // item button
      const item_from_all = document.createElement("button");
      // text
      const item_from_all_text = document.createElement("span");
      item_from_all_text.classList.add("jspsych-annotation-tool-item-from-all-text");
      item_from_all_text.textContent = item.text;
      item_from_all.appendChild(item_from_all_text);
      // metadata
      const item_from_all_metadata = document.createElement("span");
      item_from_all_metadata.classList.add("jspsych-annotation-tool-item-from-all-metadata");
      item_from_all_metadata.textContent = make_metadata_string(
        item,
        index,
        labelled_dataset.length
      );
      item_from_all.appendChild(item_from_all_metadata);
      // on item button click: show that item in main area & close side panel
      item_from_all.addEventListener("click", () => {
        cur_index = index;
        update_text();
        display_element.classList.remove("panel-open");
      });
      all_items.appendChild(item_from_all);
    });

    // button to show/hide all items side panel
    const all_items_button = document.createElement("button");
    all_items_button.textContent = "all items";
    all_items_button.addEventListener("click", () => {
      if (all_items.style.display === "none") {
        all_items.style.display = "block";
      } else {
        all_items.style.display = "none";
      }
    });
    toolbar.appendChild(all_items_button);
    ////////// ALL ITEMS END //////////

    ///// POPUP START /////
    // used by guidelines, keyboard shortcuts
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
    guidelines_button.textContent = "guidelines";
    guidelines_button.addEventListener("click", () => {
      show_popup("Guidelines", trial.guidelines);
    });
    toolbar.appendChild(guidelines_button);
    ////////// GUIDELINES END //////////

    ////////// KEYBOARD SHORTCUTS START //////////
    const keyboard_shortcuts_button = document.createElement("button");
    keyboard_shortcuts_button.textContent = "keyboard shortcuts";
    keyboard_shortcuts_button.addEventListener("click", () => {
      show_popup("Keyboard shortcuts", "A: all items\n");
    });
    toolbar.appendChild(keyboard_shortcuts_button);
    ////////// KEYBOARD SHORTCUTS END //////////

    ////////// PROGRESS START //////////
    const progress_container = document.createElement("div");
    progress_container.id = "jspsych-annotation-tool-progress-container";
    toolbar.appendChild(progress_container);

    const progress = document.createElement("progress");
    progress.max = labelled_dataset.length;
    progress.value = 0;
    progress_container.appendChild(progress);

    const progress_text = document.createElement("span");
    progress_container.appendChild(progress_text);

    const update_progress = () => {
      const labelled_count = labelled_dataset.filter((item) => item.label !== undefined).length;

      progress.value = labelled_count;

      progress_text.textContent = `${labelled_count} of ${labelled_dataset.length} labelled`;
    };
    ////////// PROGRESS END //////////

    ////////// PREV NEXT START //////////
    const prev_button = document.createElement("button");
    prev_button.textContent = "previous";
    prev_button.disabled = cur_index === 0;
    prev_button.addEventListener("click", () => {
      if (cur_index > 0) {
        cur_index--;
        update_text();
      }
    });
    toolbar.appendChild(prev_button);

    const next_button = document.createElement("button");
    next_button.textContent = "next";
    next_button.addEventListener("click", () => {
      if (cur_index < trial.labelled_dataset.length - 1) {
        cur_index++;
        update_text();
      }
    });
    toolbar.appendChild(next_button);
    ////////// PREV NEXT END //////////

    ////////// SAVE START //////////
    const save_button = document.createElement("button");
    save_button.textContent = "save";
    // event listener
    toolbar.appendChild(save_button);
    ////////// SAVE END //////////
    //////////////////// TOOLBAR END ////////////////////

    //////////////////// LABELS START ////////////////////
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

    trial.labels.forEach((label, label_index) => {
      const label_button = document.createElement("button");
      label_button.classList.add("jspsych-annotation-tool-label-button");
      label_button.textContent = label;

      label_button.addEventListener("click", () => {
        if (labelled_dataset[cur_index].label === label_index) {
          delete labelled_dataset[cur_index].label;
        } else {
          labelled_dataset[cur_index].label = label_index;
        }
        label_buttons.push(label_button);
        labels_container.appendChild(label_button);

        update_label_buttons();
        update_progress();
      });
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
    }
    //////////////////// ITEM END ////////////////////

    // initial
    update_text();
  }
}

export default AnnotationToolPlugin;
