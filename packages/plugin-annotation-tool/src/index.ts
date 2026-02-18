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
    display_element.classList.add("jspsych-annotation-tool-root");

    if (trial.stylesheet) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = trial.stylesheet;
      document.head.appendChild(link);
    }

    //////////////////// DATASET START
    // structure of items in dataset
    type dataset_item_base = {
      id: number;
      text: string;
      label?: string;
      [key: string]: any;
    };

    let labelled_dataset = structuredClone(trial.dataset) as dataset_item_base[]; // deep clone
    let cur_index = 0;
    //////////////////// DATASET END

    //////////////////// TOOLBAR START
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    //////////

    // opens an extensive side panel w/ all items listed
    const all_items_button = document.createElement("button");
    all_items_button.textContent = "all items";
    all_items_button.addEventListener("click", () => {
      all_items.classList.toggle("show");
    });
    toolbar.appendChild(all_items_button);

    // actual side panel
    const all_items = document.createElement("div");
    all_items.id = "jspsych-annotation-tool-all-items";
    display_element.appendChild(all_items);
    // for item in labelled dataset: have button for it, have all of them as list on side
    // this code still assumes that there is 'id' and 'text' in each dataset entry
    labelled_dataset.forEach((item, index) => {
      // item as whole thing, click to go to item
      const item_from_all = document.createElement("button");
      item_from_all.addEventListener("click", () => {
        cur_index = index;
        //update_text();
        display_element.classList.remove("panel-open");
      });
      all_items.appendChild(item_from_all);

      // item as whole thing shows item text & metadata so you know what youre going to
      // text
      const item_from_all_text = document.createElement("span");
      item_from_all_text.classList.add("jspsych-annotation-tool-item-from-all-text");
      item_from_all_text.textContent = item.text;
      item_from_all.appendChild(item_from_all_text);

      // metadata, so position n id
      const item_from_all_metadata = document.createElement("span");
      item_from_all_metadata.classList.add("jspsych-annotation-tool-item-from-all-metadata");
      let metadata_string = `position: ${index + 1} of ${labelled_dataset.length} | id: ${item.id}`;
      // other keys & values
      Object.entries(item).forEach(([key, value]) => {
        if (key !== "id" && key !== "text") {
          metadata_string += ` | ${key}: ${value}`;
        }
      });
      item_from_all_metadata.textContent = metadata_string;
      item_from_all.appendChild(item_from_all_metadata);
    });

    const guidelines_button = document.createElement("button");
    guidelines_button.textContent = "guidelines";
    // event listener
    toolbar.appendChild(guidelines_button);

    const keyboard_shortcuts_button = document.createElement("button");
    keyboard_shortcuts_button.textContent = "keyboard shortcuts";
    // event listener
    toolbar.appendChild(keyboard_shortcuts_button);

    const progress = document.createElement("progress");
    // progress.textContent = "1 of 100 labelled";
    // updating idk
    // set attribute max = total num of items
    toolbar.appendChild(progress);

    const prev_button = document.createElement("button");
    prev_button.textContent = "previous";
    // prev_button.addEventListener("click", () => {
    //   if (cur_index > 0) {
    //     cur_index--;
    //     update_text();
    //   }
    // });
    toolbar.appendChild(prev_button);

    const next_button = document.createElement("button");
    next_button.textContent = "next";
    // next_button.addEventListener("click", () => {
    //   if (cur_index < trial.dataset.length - 1) {
    //     cur_index++;
    //     update_text();
    //   }
    // });
    toolbar.appendChild(next_button);

    const save_button = document.createElement("button");
    save_button.textContent = "save";
    // event listener
    toolbar.appendChild(save_button);
    //////////////////// TOOLBAR END

    //////////////////// LABELS START
    const labels_container = document.createElement("div");
    labels_container.id = "jspsych-annotation-tool-labels-container";
    // for each label, create button
    // event listener: when selected, change colour/text whatever & add/remove label to/from item in labelled_dataset
    display_element.appendChild(labels_container);
    //////////////////// LABELS END

    //////////////////// ITEM START
    const item_container = document.createElement("div");
    item_container.id = "jspsych-annotation-tool-item-container";
    display_element.appendChild(item_container);

    const metadata = document.createElement("p");
    metadata.id = "jspsych-annotation-tool-metadata";
    //metadata.textContent = "position 1 of 100\nid = 123";
    item_container.appendChild(metadata);

    const item = document.createElement("p");
    item.id = "jspsych-annotation-tool-item";
    // set item content
    item_container.appendChild(item);
    //////////////////// ITEM END

    // update item function
  }
}

export default AnnotationToolPlugin;
