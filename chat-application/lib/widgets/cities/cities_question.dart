import 'package:awachat/widgets/cities/confirm_page.dart';
import 'package:awachat/widgets/cities/question_page.dart';
import 'package:flutter/material.dart';
import 'package:awachat/store/memory.dart';

// Question Tree
class CitiesQuestion extends StatefulWidget {
  const CitiesQuestion({Key? key, required this.cities}) : super(key: key);

  final List<String> cities;

  @override
  State<CitiesQuestion> createState() => _CitiesQuestionState();
}

class _CitiesQuestionState extends State<CitiesQuestion> {
  List<String> pages = [];
  final PageController controller = PageController();

  dynamic readArgument(String arg, String pageId, String answerId,
      {dynamic defaultArg}) {
    return widget.yaml['nodes'][pageId]['answers'][answerId][arg] ??
        widget.yaml['nodes'][pageId][arg] ??
        widget.yaml['defaults'][arg] ??
        defaultArg;
  }

  void Function(String) createValidateAnswer(String pageId) {
    return (String answerId) {
      if (!widget.yaml['nodes'].containsKey(pageId)) {
        return;
      }

      if (Memory().boxAnswers.get(pageId) == answerId) {
        // un-select
        Memory().boxAnswers.delete(pageId);
      } else {
        // select
        // answer question (recursive flatten)
        String? currentPageId = pageId;
        String? currentAnswerId = answerId;
        while (currentPageId != null && currentAnswerId != null) {
          // store answer
          final bool isDiscriminating = readArgument(
              'isDiscriminating', currentPageId, currentAnswerId,
              defaultArg: false);

          Memory().boxAnswers.put(
              currentPageId, '${isDiscriminating ? '_' : ''}$currentAnswerId');

          // move to next page
          final String lastPageId = currentPageId;
          currentPageId = readArgument('next', currentPageId, currentAnswerId);
          if (currentPageId == null) {
            continue;
          }

          // remove answers discriminating if going back
          for (int i = pages.indexOf(currentPageId) + 1;
              i >= 0 && i <= pages.indexOf(lastPageId);
              i++) {
            Memory().boxAnswers.put(
                currentPageId,
                (Memory().boxAnswers.get(pages[i]) ?? '')
                    .replaceFirst(RegExp(r'^_'), ''));
          }

          // clear current question
          Memory().boxAnswers.delete(currentPageId);

          // read automatic answer if any
          currentAnswerId =
              readArgument('nextAnswer', lastPageId, currentAnswerId);
        }
        // animate to next page
        Future.delayed(const Duration(milliseconds: 250), () {
          // move to next page
          setState(() {
            pages.add(currentPageId ?? 'end');
          });
          controller.nextPage(
              duration: const Duration(milliseconds: 500),
              curve: Curves.easeInOut);
        });
      }

      setState(() {});
    };
  }

  @override
  void initState() {
    super.initState();
    pages.add(widget.yaml['root'] ?? 'end');
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      itemCount: pages.length,
      physics: const NeverScrollableScrollPhysics(parent: PageScrollPhysics()),
      controller: controller,
      itemBuilder: (BuildContext context, int index) {
        String pageId = pages[index];
        if (pageId == 'end' || !widget.yaml['nodes'].containsKey(pageId)) {
          return const ConfirmPage();
        }

        return QuestionPage(
          questionId: pageId,
          question: widget.yaml['nodes'][pageId],
          onPressed: createValidateAnswer(pageId),
        );
      },
    );
  }
}
