/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";

type State = {
    isOpen: boolean;
};

export class SidePanel extends Component<{}, State> {
    state = { isOpen: false };

    togglePanel = () => {
        this.setState((prevState) => ({ isOpen: !prevState.isOpen }));
    };

    render() {
        const { isOpen } = this.state;

        return (
            <div
                class={`fixed inset-y-0 left-0 transform transition-transform duration-300 bg-gray-800 text-white z-50 ${
                    isOpen ? "translate-x-0" : "-translate-x-12" // Adjust as needed for the width of the button
                }`}
            >
                <button
                    onClick={this.togglePanel}
                    class="p-4 text-white bg-blue-500 absolute top-0 left-0"
                >
                    Menu
                </button>

                <ul class={`${isOpen ? "block" : "hidden"} mt-12`}>
                    <li class="p-4 hover:bg-gray-700">Home</li>
                    <li class="p-4 hover:bg-gray-700">Profile</li>
                    <li class="p-4 hover:bg-gray-700">Settings</li>
                </ul>
            </div>
        );
    }
}
