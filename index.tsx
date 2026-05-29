/*
 * Vencord Plugin - CleanDMs
 */

import "./style.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { addContextMenuPatch, removeContextMenuPatch } from "@api/ContextMenu";

import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";

import { findByPropsLazy } from "@webpack";
import { Menu, React } from "@webpack/common";

const MessageActions = findByPropsLazy("deleteMessage");
const MessageStore = findByPropsLazy("getMessages");
const UserStore = findByPropsLazy("getCurrentUser");

let cleaning = false;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanDM(channelId: string) {
    // STOP CLEANING
    if (cleaning) {
        cleaning = false;
        return;
    }

    cleaning = true;

    const currentUser = UserStore.getCurrentUser();

    while (cleaning) {
        try {
            const messages =
                MessageStore.getMessages(channelId)?._array ?? [];

            const ownMessages = messages
                .filter((m: any) =>
                    m?.author?.id === currentUser.id
                )
                .sort((a: any, b: any) =>
                    b.timestamp - a.timestamp
                );

            if (!ownMessages.length) {
                await sleep(2000);
                continue;
            }

            for (const msg of ownMessages) {
                if (!cleaning) break;

                try {
                    await MessageActions.deleteMessage(
                        channelId,
                        msg.id
                    );

                    console.log(
                        "[CleanDMs] Deleted:",
                        msg.id
                    );
                } catch (err) {
                    console.error(
                        "[CleanDMs] Failed deleting:",
                        err
                    );
                }

                // rate limit safety
                await sleep(1200);
            }
        } catch (e) {
            console.error("[CleanDMs]", e);
        }

        await sleep(1500);
    }
}

function makeMenuItem(channelId: string) {
    return (
        <Menu.MenuItem
            id="vc-clean-dms"
            label={cleaning ? "Stop Cleaning" : "Clean DM's"}
            color="danger"
            action={() => cleanDM(channelId)}
        />
    );
}

function patchContext(children: any[], props: any) {
    const channelId =
        props.channel?.id ||
        props.channelId ||
        props.user?.dmChannelId;

    if (!channelId) return;

    children.push(makeMenuItem(channelId));
}

export const TrashIcon = ({
    active,
    height = 20,
    width = 20,
    className
}: {
    active: boolean;
    height?: number;
    width?: number;
    className?: string;
}) => {
    return (
        <svg
            viewBox="0 -960 960 960"
            height={height}
            width={width}
            className={classes(className)}
            fill="currentColor"
        >
            {active ? (
                // STOP ICON
                <path d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z" />
            ) : (
                // TRASH ICON
                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z" />
            )}
        </svg>
    );
};

export const CleanDMChatBarButton: ChatBarButtonFactory = ({
    isMainChat,
    channel
}) => {
    if (!isMainChat || !channel) return null;

    const [active, setActive] = React.useState(cleaning);

    const toggleCleaning = async () => {
        // instantly update icon
        setActive(!cleaning);

        await cleanDM(channel.id);

        // sync after action
        setActive(cleaning);
    };

    return (
        <ChatBarButton
            tooltip={
                active
                    ? "Stop Cleaning"
                    : "Clean DM's"
            }
            onClick={toggleCleaning}
        >
            <TrashIcon active={active} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "CleanDMs",
    description: "Delete your own DM messages continuously",

    authors: [
        {
            name: "r3",
            id: "1412136426438397972"
        }
    ],

    chatBarButton: {
        icon: () => null,
        render: CleanDMChatBarButton
    },

    start() {
        addContextMenuPatch(
            "user-context",
            patchContext
        );

        addContextMenuPatch(
            "channel-context",
            patchContext
        );
    },

    stop() {
        cleaning = false;

        removeContextMenuPatch(
            "user-context",
            patchContext
        );

        removeContextMenuPatch(
            "channel-context",
            patchContext
        );
    }
});