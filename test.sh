echo 'Get updated filed'
has_edited_chat_application=false
has_edited_chat_backend=false
git diff --name-only origin/main... > files.txt
echo '----- ----- -----'
cat files.txt
echo '----- ----- -----'

while IFS= read -r file
do
if [[ $file != chat-application/** ]]; then
    has_edited_chat_application=true
elif [[ $file != chat-backend/** ]]; then
    has_edited_chat_backend=true
fi
done < files.txt

if [ "$has_edited_chat_application" = true ] ; then
echo "You've edited chat-application/"
fi

if [ "$has_edited_chat_backend" = true ] ; then
echo "You've edited chat-backend/"
fi

if [ "$has_edited_chat_application" = true ] && [ "$has_edited_chat_backend" = true ] ; then
echo 'You cannot edit chat-application/ and chat-backend/!'
exit 1
fi