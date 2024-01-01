export async function notify(title: string, msg: string, icon: string, onclick: () => void) {
    try {
        if (Notification.permission == "denied") {
            console.warn(`Notification.permission == "denied"`);
            return;
        } else if (Notification.permission !== "granted") {
            const result = await Notification.requestPermission();
            if (result != "granted") {
                console.warn(`the user denied the request: ${result}`);
            }
            return;
        }
        const notification = new Notification(title, {
            body: msg,
            icon: icon,
        });
        notification.onclick = (_) => {
            window.parent.parent.focus();
            notification.close();
            onclick();
        };
    } catch (e) {
        console.error(e);
    }
}
