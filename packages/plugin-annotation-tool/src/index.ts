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
    button_html: {
      type: ParameterType.FUNCTION,
      default: function (label: string, label_index: number) {
        return `<button class="jspsych-button">${label}</button>`;
      },
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
    let labelled_dataset = JSON.parse(JSON.stringify(trial.dataset)).sort(
      (a: { id: number }, b: { id: number }) => a.id - b.id
    );
    let cur_index = 0;
    ////////////////////

    ////////////////////
    const nav_buttons_element = document.createElement("div");
    nav_buttons_element.id = "jspsych-annotation-tool-nav-buttons";
    nav_buttons_element.style.display = "flex";
    nav_buttons_element.style.gap = "8px";
    nav_buttons_element.style.alignItems = "center";
    display_element.appendChild(nav_buttons_element);

    const prev_button = document.createElement("button");
    prev_button.innerHTML = "previous";
    prev_button.addEventListener("click", () => {
      if (cur_index > 0) {
        cur_index--;
        update_text();
      }
    });
    nav_buttons_element.appendChild(prev_button);

    const next_button = document.createElement("button");
    next_button.innerHTML = "next";
    next_button.addEventListener("click", () => {
      if (cur_index < trial.dataset.length - 1) {
        cur_index++;
        update_text();
      }
    });
    nav_buttons_element.appendChild(next_button);

    const annotator_name_input = document.createElement("input");
    annotator_name_input.type = "text";
    annotator_name_input.placeholder = "annotator name";
    annotator_name_input.style.marginLeft = "10px";
    nav_buttons_element.appendChild(annotator_name_input);

    const finish_button = document.createElement("button");
    finish_button.innerHTML = "finish";
    finish_button.addEventListener("click", () => {
      const trial_data = {
        annotator: annotator_name_input.value,
        labelled_dataset: labelled_dataset,
      };
      // this.jsPsych.data.getLastTrialData().localSave('json', `${trial_data.annotator}.json`);
      const blob = new Blob([JSON.stringify([trial_data], null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${trial_data.annotator}.json`;
      link.click();
    });
    nav_buttons_element.appendChild(finish_button);
    ////////////////////

    ////////////////////
    const label_select_element = document.createElement("select");
    label_select_element.id = "jspsych-annotation-tool-label-select";

    const placeholder_option = document.createElement("option");
    placeholder_option.value = "";
    placeholder_option.textContent = "-- select label --";
    label_select_element.appendChild(placeholder_option);

    trial.labels.forEach((label, label_index) => {
      const option = document.createElement("option");
      option.value = label_index.toString();
      option.textContent = label;
      label_select_element.appendChild(option);
    });

    label_select_element.addEventListener("change", () => {
      const value = label_select_element.value;
      if (value === "") {
        delete labelled_dataset[cur_index].label;
      } else {
        labelled_dataset[cur_index].label = Number(value);
      }
    });
    display_element.appendChild(label_select_element);
    // const label_buttons_element = document.createElement("div");
    // label_buttons_element.id = "jspsych-annotation-tool-label-buttons";
    // for (const [label_index, label] of trial.labels.entries()) {
    //   label_buttons_element.insertAdjacentHTML("beforeend", trial.button_html(label, label_index));
    //   const button_element = label_buttons_element.lastChild as HTMLElement;
    //   button_element.dataset.label = label_index.toString();
    //   button_element.addEventListener("click", () => {
    //     labelled_dataset[cur_index].label = label_index;
    //   });
    // }
    // display_element.appendChild(label_buttons_element);

    ////////////////////

    ////////////////////
    const text_element = document.createElement("div");
    text_element.id = "jspsych-annotation-tool-text";
    display_element.appendChild(text_element);
    ////////////////////

    ////////////////////
    const update_label_select = () => {
      const label = labelled_dataset[cur_index].label;
      label_select_element.value = label === undefined ? "" : label.toString();
    };
    ////////////////////

    ////////////////////
    const update_text = () => {
      const entry = labelled_dataset[cur_index];
      text_element.dataset.id = entry.id;
      text_element.innerHTML = entry.text;

      prev_button.disabled = cur_index === 0;
      next_button.disabled = cur_index === labelled_dataset.length - 1;

      update_label_select();
    };
    ////////////////////

    update_text();
  }
}

export default AnnotationToolPlugin;
