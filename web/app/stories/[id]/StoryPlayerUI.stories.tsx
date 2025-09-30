import type { Meta, StoryObj } from "@storybook/react";
import { StoryPlayerUI } from "./StoryPlayerUI";

const meta: Meta<typeof StoryPlayerUI> = {
  title: "Components/StoryPlayerUI",
  component: StoryPlayerUI,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    phase: {
      control: { type: "select" },
      options: ["idle", "running", "waiting", "finished", "error"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "",
    currentSpeaker: "",
    phase: "idle",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: true,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const Playing: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "You find yourself standing in a dimly lit room. The air is thick with dust, and somewhere in the distance, you hear the faint sound of dripping water.",
    currentSpeaker: "Narrator",
    phase: "running",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const CharacterSpeaking: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "Welcome, traveler. I've been expecting you. The prophecy spoke of your arrival on this very night.",
    currentSpeaker: "Mysterious Stranger",
    phase: "running",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const WaitingForInput: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "The stranger extends a weathered hand towards you. What do you do?",
    currentSpeaker: "Narrator",
    phase: "waiting",
    input: "",
    error: null,
    isInputActive: true,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const WaitingWithPartialInput: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "The stranger extends a weathered hand towards you. What do you do?",
    currentSpeaker: "Narrator",
    phase: "waiting",
    input: "I shake their hand and introduce myself",
    error: null,
    isInputActive: true,
    canPlay: true,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const ShowingUserInput: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "> I shake their hand and introduce myself politely",
    currentSpeaker: "You",
    phase: "running",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const Finished: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "The End",
    currentSpeaker: "",
    phase: "finished",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const Error: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "Something went wrong. Please try again.",
    currentSpeaker: "",
    phase: "error",
    input: "",
    error: "Failed to connect to the story server",
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const LongText: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "The old man begins to speak, his voice carrying the weight of countless years. 'Long ago, before the mountains were born and when the seas were young, there existed a kingdom unlike any other. Its towers reached toward the heavens, gleaming with gold and silver in the eternal sunlight. The people lived in harmony, their hearts pure and their minds clear. But as with all things touched by time, change was inevitable. Darkness crept in from the edges of the world, slowly at first, then with gathering speed. The kingdom that had stood for a thousand generations began to crumble, stone by stone, dream by dream.'",
    currentSpeaker: "Elder Storyteller",
    phase: "running",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};

export const ShortText: Story = {
  args: {
    title: "The Mystery of the Lost Key",
    currentText: "Yes.",
    currentSpeaker: "Guard",
    phase: "running",
    input: "",
    error: null,
    isInputActive: false,
    canPlay: false,
    onPlayClick: () => console.log("Play clicked"),
    onInputChange: () => console.log("Input changed"),
    onSubmit: (e) => {
      e.preventDefault();
      console.log("Form submitted");
    },
  },
};