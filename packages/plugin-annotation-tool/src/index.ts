import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-annotation-tool",
  version: version,
  parameters: {
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
    ////////////////////
    let labelled_dataset = structuredClone(trial.dataset);
    // let labelled_dataset = JSON.parse(JSON.stringify(trial.dataset));
    let cur_index = 0;
    ////////////////////

    ////////////////////
    const toolbar = document.createElement("div");
    toolbar.id = "jspsych-annotation-tool-toolbar";
    display_element.appendChild(toolbar);

    const all_entries_button = document.createElement("button");
    all_entries_button.innerHTML = "all entries";
    // event listener
    toolbar.appendChild(all_entries_button);

    const guidelines_button = document.createElement("button");
    guidelines_button.innerHTML = "guidelines";
    // event listener
    toolbar.appendChild(guidelines_button);

    const keyboard_shortcuts_button = document.createElement("button");
    keyboard_shortcuts_button.innerHTML = "keyboard_shortcuts";
    // event listener
    toolbar.appendChild(keyboard_shortcuts_button);

    const cur_entry_number = document.createElement("progress");
    cur_entry_number.innerHTML = "1 of 100";
    // updating idk
    // set attribute max = total num of entries
    toolbar.appendChild(cur_entry_number);

    const prev_button = document.createElement("button");
    prev_button.innerHTML = "previous";
    // prev_button.addEventListener("click", () => {
    //   if (cur_index > 0) {
    //     cur_index--;
    //     update_text();
    //   }
    // });
    toolbar.appendChild(prev_button);

    const next_button = document.createElement("button");
    next_button.innerHTML = "next";
    // next_button.addEventListener("click", () => {
    //   if (cur_index < trial.dataset.length - 1) {
    //     cur_index++;
    //     update_text();
    //   }
    // });
    toolbar.appendChild(next_button);

    const save_button = document.createElement("button");
    save_button.innerHTML = "save";
    // event listener
    toolbar.appendChild(save_button);
    ////////////////////

    ////////////////////
    const labels_container = document.createElement("div");
    labels_container.id = "jspsych-annotation-tool-label";
    // for each label, create button
    // event listener: when selected, change colour/text whatever & add/remove label to/from entry in labelled_dataset
    display_element.appendChild(labels_container);
    ////////////////////

    ////////////////////
    const entry_container = document.createElement("div");
    entry_container.id = "jspsych-annotation-tool-entry";
    display_element.appendChild(entry_container);
    ////////////////////

    // update entry function
  }
}

export default AnnotationToolPlugin;
